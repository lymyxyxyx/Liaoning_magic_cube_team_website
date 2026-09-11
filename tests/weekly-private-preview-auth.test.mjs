import assert from "node:assert/strict";
import test from "node:test";
import { createSessionToken, verifySessionToken } from "../lib/auth.ts";
import { canReadWeeklyMeet } from "../lib/weekly-read-access.ts";
import { isGuestWeeklyHistoryMeet, isWeeklyMeetVisibleToGuests } from "../lib/weekly-guest-history.ts";

test("weekly meet read access requires public visibility or weekly-admin auth", () => {
  assert.equal(canReadWeeklyMeet({ exists: true, isPublic: true, isWeeklyAdmin: false }), true);
  assert.equal(canReadWeeklyMeet({ exists: true, isPublic: false, isWeeklyAdmin: false }), false);
  assert.equal(canReadWeeklyMeet({ exists: true, isPublic: true, isWeeklyAdmin: true }), true);
  assert.equal(canReadWeeklyMeet({ exists: true, isPublic: false, isWeeklyAdmin: true }), true);
  assert.equal(canReadWeeklyMeet({ exists: false, isPublic: false, isWeeklyAdmin: true }), false);
});

test("weekly-admin tokens remain isolated from site-admin auth", async () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "weekly-private-preview-regression-secret";
  try {
    const token = await createSessionToken("unused", "weekly-admin");
    assert.equal(await verifySessionToken(token, "weekly-admin"), true);
    assert.equal(await verifySessionToken(token, "site-admin"), false);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("private meets never become guest-visible because time has passed", () => {
  const now = new Date("2026-09-12T00:00:00Z");
  const privatePastMeet = {
    id: "weekly-2026-08-17", dataVersion: 2, isPublic: false, status: "closed",
    startsAt: "2026-08-16T16:00:00Z", endsAt: "2026-08-23T15:59:59Z"
  };
  const privateCurrentMeet = {
    id: "weekly-2026-09-07", dataVersion: 2, isPublic: false, status: "open",
    startsAt: "2026-09-06T16:00:00Z", endsAt: "2026-09-13T15:59:59Z"
  };
  const publicPastMeet = { ...privatePastMeet, isPublic: true };

  assert.equal(isGuestWeeklyHistoryMeet(privatePastMeet, now), false);
  assert.equal(isWeeklyMeetVisibleToGuests(privatePastMeet), false);
  assert.equal(isWeeklyMeetVisibleToGuests(privateCurrentMeet), false);
  assert.equal(isGuestWeeklyHistoryMeet(publicPastMeet, now), true);
  assert.equal(isWeeklyMeetVisibleToGuests(publicPastMeet), true);
});
