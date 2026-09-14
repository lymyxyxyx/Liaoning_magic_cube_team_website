import assert from "node:assert/strict";
import test from "node:test";
import { isBigStackEventId, isWeeklySingleAttemptEvent, WEEKLY_DEFAULT_EVENT_IDS } from "../lib/wca-events.ts";

test("weekly big-stack exposes only the ready sub-events by default", () => {
  assert.deepEqual(WEEKLY_DEFAULT_EVENT_IDS.slice(-2), ["bigstack333", "bigstackmirror"]);
  assert.equal(isBigStackEventId("bigstack333"), true);
  assert.equal(isBigStackEventId("bigstack222"), true);
  assert.equal(isBigStackEventId("333"), false);
});

test("big-stack sub-events use the single-fastest format", () => {
  assert.equal(isWeeklySingleAttemptEvent("bigstack333"), true);
  assert.equal(isWeeklySingleAttemptEvent("bigstackmirror"), true);
  assert.equal(isWeeklySingleAttemptEvent("333"), false);
});
