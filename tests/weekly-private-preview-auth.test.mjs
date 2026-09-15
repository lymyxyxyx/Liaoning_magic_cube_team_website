import assert from "node:assert/strict";
import test from "node:test";
import { createSessionToken, verifySessionToken } from "../lib/auth.ts";
import { canReadWeeklyMeet } from "../lib/weekly-read-access.ts";
import { isGuestVisibleWeeklyMeet, isWeeklyMeetVisibleToGuests } from "../lib/weekly-guest-history.ts";
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

test("every real weekly meet is guest-visible and the internal test meet stays private", () => {
  assert.equal(isGuestVisibleWeeklyMeet({ id: "weekly-2026-08-17" }), true);
  assert.equal(isWeeklyMeetVisibleToGuests({ id: "weekly-legacy-private" }), true);
  assert.equal(isGuestVisibleWeeklyMeet({ id: "weekly-test-entry" }), false);
});

test("weekly meet status follows its configured time window", () => {
  const start = "2026-09-14T00:00:00+08:00";
  const end = "2026-09-20T23:59:59+08:00";
  assert.equal(getWeeklyMeetStatus({ status: "draft", startsAt: start, endsAt: end }, new Date("2026-09-13T23:59:59+08:00").getTime()), "draft");
  assert.equal(getWeeklyMeetStatus({ status: "closed", startsAt: start, endsAt: end }, new Date("2026-09-14T00:00:00+08:00").getTime()), "open");
  assert.equal(isWeeklyMeetCurrent({ status: "open", startsAt: start, endsAt: end }, new Date("2026-09-20T23:59:59+08:00").getTime()), true);
  assert.equal(getWeeklyMeetStatus({ status: "open", startsAt: start, endsAt: end }, new Date("2026-09-21T00:00:00+08:00").getTime()), "closed");
});
