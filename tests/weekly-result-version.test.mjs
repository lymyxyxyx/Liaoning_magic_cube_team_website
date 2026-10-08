import assert from "node:assert/strict";
import test from "node:test";
import { assertWeeklyResultVersion, WeeklyResultConflictError } from "../lib/weekly-result-version.ts";

test("stale edits and deletes reject changed or missing rows without rounding timestamp precision", () => {
  const first = "2026-10-08 10:00:00.123456+00";
  assert.doesNotThrow(() => assertWeeklyResultVersion(first, first));
  assert.throws(() => assertWeeklyResultVersion("2026-10-08 10:00:00.123457+00", first), WeeklyResultConflictError);
  assert.throws(() => assertWeeklyResultVersion(undefined, first), WeeklyResultConflictError);
  assert.throws(() => assertWeeklyResultVersion(first, ""), WeeklyResultConflictError);
});
