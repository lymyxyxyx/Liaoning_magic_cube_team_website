import assert from "node:assert/strict";
import test from "node:test";
import { createSessionToken, verifySessionToken } from "../lib/auth.ts";
import { canReadWeeklyMeet } from "../lib/weekly-read-access.ts";
import { isGuestWeeklyHistoryMeet, isWeeklyMeetVisibleToGuests } from "../lib/weekly-guest-history.ts";
import { getWeeklyMeetStatus, isWeeklyMeetCurrent } from "../lib/weekly-meet-status.ts";

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

test("v2 meets are guest-visible while legacy private meets remain hidden", () => {
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
  const legacyPrivateMeet = { ...privatePastMeet, id: "weekly-legacy-private", dataVersion: 1 };

  assert.equal(isGuestWeeklyHistoryMeet(privatePastMeet, now), true);
  assert.equal(isWeeklyMeetVisibleToGuests(privatePastMeet), true);
  assert.equal(isWeeklyMeetVisibleToGuests(privateCurrentMeet), true);
  assert.equal(isGuestWeeklyHistoryMeet(publicPastMeet, now), true);
  assert.equal(isWeeklyMeetVisibleToGuests(publicPastMeet), true);
  assert.equal(isWeeklyMeetVisibleToGuests(legacyPrivateMeet), false);

  const start = "2026-09-14T00:00:00+08:00";
  const end = "2026-09-20T23:59:59+08:00";
  assert.equal(getWeeklyMeetStatus({ status: "draft", startsAt: start, endsAt: end }, new Date("2026-09-13T23:59:59+08:00").getTime()), "draft");
  assert.equal(getWeeklyMeetStatus({ status: "closed", startsAt: start, endsAt: end }, new Date("2026-09-14T00:00:00+08:00").getTime()), "open");
  assert.equal(isWeeklyMeetCurrent({ status: "open", startsAt: start, endsAt: end }, new Date("2026-09-20T23:59:59+08:00").getTime()), true);
  assert.equal(getWeeklyMeetStatus({ status: "open", startsAt: start, endsAt: end }, new Date("2026-09-21T00:00:00+08:00").getTime()), "closed");
});
