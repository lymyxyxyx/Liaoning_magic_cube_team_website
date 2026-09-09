import assert from "node:assert/strict";
import test from "node:test";
import { sortWeeklyResultsByAverage } from "../lib/weekly-result-display.ts";

function result(playerName, average, personalBest) {
  return { playerName, average, personalBest };
}

test("weekly detail display sorts faster averages first and places DNF averages last", () => {
  const sorted = sortWeeklyResultsByAverage([
    result("慢", 18.2, 16.1),
    result("DNF", -1, 9.1),
    result("快", 8.6, 8.2),
    result("同平均更快单次", 12, 10),
    result("同平均较慢单次", 12, 11)
  ]);

  assert.deepEqual(sorted.map((item) => item.playerName), ["快", "同平均更快单次", "同平均较慢单次", "慢", "DNF"]);
});
