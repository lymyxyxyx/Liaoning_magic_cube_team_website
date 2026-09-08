import assert from "node:assert/strict";
import test from "node:test";
import { weeklyBusinessDate, weeklyImportDateWarnings } from "../lib/weekly-results-import-dates.ts";

test("Shanghai business date preserves the local date across the UTC boundary", () => {
  assert.equal(weeklyBusinessDate(new Date("2026-06-28T16:00:00.000Z")), "2026-06-29");
});

test("matching start and end dates produce no import warning", () => {
  assert.deepEqual(
    weeklyImportDateWarnings(
      { start_date: "2026-06-29", end_date: "2026-07-05" },
      { startDate: "2026-06-29", endDate: "2026-07-05" }
    ),
    []
  );
});

test("a real one-day mismatch remains a warning", () => {
  assert.deepEqual(
    weeklyImportDateWarnings(
      { start_date: "2026-06-28", end_date: "2026-07-05" },
      { startDate: "2026-06-29", endDate: "2026-07-05" }
    ),
    ["比赛信息日期与当前周赛不同"]
  );
});
