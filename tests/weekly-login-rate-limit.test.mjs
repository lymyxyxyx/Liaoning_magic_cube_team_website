import assert from "node:assert/strict";
import test from "node:test";
import { clearWeeklyLoginFailures, getWeeklyLoginRateLimit, recordWeeklyLoginFailure } from "../lib/weekly-login-rate-limit.ts";

test("five failed weekly-admin logins pause for one minute and then reset", () => {
  const originalNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  const request = { headers: new Headers() };
  const key = getWeeklyLoginRateLimit(request).key;

  try {
    clearWeeklyLoginFailures(key);
    for (let attempt = 1; attempt < 5; attempt++) assert.equal(recordWeeklyLoginFailure(key), 0);
    assert.equal(recordWeeklyLoginFailure(key), 60);

    const blocked = getWeeklyLoginRateLimit(request);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterSeconds, 60);

    now += 60_000;
    assert.equal(getWeeklyLoginRateLimit(request).allowed, true);
    assert.equal(recordWeeklyLoginFailure(key), 0);
  } finally {
    clearWeeklyLoginFailures(key);
    Date.now = originalNow;
  }
});
