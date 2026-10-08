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

test("weekly detail rebuilds ranks by score rather than imported group ranks", () => {
  const sorted = sortWeeklyResultsByAverage([
    { ...result("第二名", 10, 8), sourceRank: 2 },
    { ...result("第一名", 10, 9), sourceRank: 1 }
  ]);

  assert.deepEqual(sorted.map((item) => item.playerName), ["第二名", "第一名"]);
});


test("big-stack history displays larger final counts first", () => {
  const ranked = sortWeeklyResultsByAverage([
    { ...result("少", 100, 100), rank: 1, sourceRank: 1 },
    { ...result("多", 120, 120), rank: 1, sourceRank: 2 },
    { ...result("DNF", -1, -1), rank: 2 }
  ], true);
  assert.deepEqual(ranked.map(({ playerName, rank }) => [playerName, rank]), [["多", 1], ["少", 2], ["DNF", 3]]);
});


test("historical overall ranking replaces duplicated age-group ranks", () => {
  const sorted = sortWeeklyResultsByAverage([
    { ...result("慢", 18, 8), rank: 1, sourceRank: 1 },
    { ...result("快", 12, 9), rank: 1, sourceRank: 1 },
    { ...result("中", 15, 10), rank: 2 }
  ]);
  assert.deepEqual(sorted.map(({ playerName, rank }) => [playerName, rank]), [["快", 1], ["中", 2], ["慢", 3]]);
});

test("average ties use the current round's best instead of a historical PB", () => {
  const sorted = sortWeeklyResultsByAverage([
    { ...result("历史PB快", 12, 5), rank: 1, attempts: [11, 12, 13] },
    { ...result("本周单次快", 12, 8), rank: 2, attempts: [10, 12, 14] }
  ]);
  assert.deepEqual(sorted.map((row) => row.playerName), ["本周单次快", "历史PB快"]);
});
