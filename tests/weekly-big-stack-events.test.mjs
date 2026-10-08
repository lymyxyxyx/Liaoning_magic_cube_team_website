import assert from "node:assert/strict";
import test from "node:test";
import { isBigStackEventId, isWeeklySingleAttemptEvent, WEEKLY_DEFAULT_EVENT_IDS } from "../lib/wca-events.ts";

test("weekly big-stack exposes only the ready sub-events by default", () => {
  assert.deepEqual(WEEKLY_DEFAULT_EVENT_IDS.slice(-2), ["bigstack333", "bigstackmirror"]);
  assert.equal(isBigStackEventId("bigstack333"), true);
  assert.equal(isBigStackEventId("bigstack222"), true);
  assert.equal(isBigStackEventId("333"), false);
});

test("big-stack sub-events require one final result", () => {
  assert.equal(isWeeklySingleAttemptEvent("bigstack333"), true);
  assert.equal(isWeeklySingleAttemptEvent("bigstackmirror"), true);
  assert.equal(isWeeklySingleAttemptEvent("333"), false);
});


test("big-stack count round-trips through the existing stored result representation", async () => {
  const { parseCountResultInput, formatCountResult, calculateResultByFormat, resultValueToSeconds, secondsToResultValue, isBetterWeeklyResult } = await import("../lib/weekly-result-utils.ts");
  for (const input of ["0", "59", "120", "3600"]) {
    const parsed = parseCountResultInput(input);
    const calculated = calculateResultByFormat([parsed], "best1");
    const stored = resultValueToSeconds(calculated.average);
    assert.equal(stored, Number(input));
    assert.equal(formatCountResult(secondsToResultValue(stored)), input);
  }
  for (const invalid of ["", "12.5", "1:20", "12秒", "-1", "1e3", "21474837"]) {
    assert.throws(() => parseCountResultInput(invalid));
  }
  assert.equal(formatCountResult(parseCountResultInput("DNF")), "DNF");
  assert.equal(formatCountResult(parseCountResultInput("DNS")), "DNS");
  assert.equal(isBetterWeeklyResult(120, 100, true), true);
  assert.equal(isBetterWeeklyResult(100, 120, true), false);
  assert.equal(isBetterWeeklyResult(120, 120, true), false);
  assert.equal(isBetterWeeklyResult(0, null, true), true);
  assert.equal(isBetterWeeklyResult(-1, 120, true), false);
  assert.equal(isBetterWeeklyResult(10, 12), true);
});
