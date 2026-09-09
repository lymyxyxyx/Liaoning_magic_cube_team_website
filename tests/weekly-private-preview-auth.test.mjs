import assert from "node:assert/strict";
import test from "node:test";
import { createSessionToken, verifySessionToken } from "../lib/auth.ts";
import { canReadWeeklyMeet } from "../lib/weekly-read-access.ts";

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
