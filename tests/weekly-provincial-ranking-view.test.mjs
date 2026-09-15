import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyProvincialRankingView } from "../lib/weekly-provincial-ranking-view.ts";

const rankings = [
  { rank: 1, playerId: "all-1", ageGroup: "成人", average: 5.1 },
  { rank: 2, playerId: "u8-1", ageGroup: "U8", average: 6.2 },
  { rank: 3, playerId: "u10-1", ageGroup: "U10", average: 7.3 },
  { rank: 4, playerId: "u8-2", ageGroup: "U8", average: 8.4 },
  { rank: 4, playerId: "u8-3", ageGroup: "U8", average: 8.4 },
  { rank: 6, playerId: "u8-4", ageGroup: "U8", average: 9.5 }
];

test("age-group filtering rebuilds ranks inside the selected group", () => {
  const visible = buildWeeklyProvincialRankingView(rankings, "U8");
  assert.deepEqual(visible.map(({ playerId, rank }) => ({ playerId, rank })), [
    { playerId: "u8-1", rank: 1 },
    { playerId: "u8-2", rank: 2 },
    { playerId: "u8-3", rank: 2 },
    { playerId: "u8-4", rank: 4 }
  ]);
});

test("all-group view keeps the provincial ranks unchanged", () => {
  assert.equal(buildWeeklyProvincialRankingView(rankings, ""), rankings);
});
