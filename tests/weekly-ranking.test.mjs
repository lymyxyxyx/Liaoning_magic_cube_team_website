import assert from "node:assert/strict";
import test from "node:test";
import { getWeeklyRankingAgeGroup, getWeeklyRankingAgeGroupOrder } from "../lib/weekly-age-groups.ts";
import { buildWeeklyRankAssignments } from "../lib/weekly-ranking.ts";

test("ranking consistently uses the meet date for a player crossing an age boundary", () => {
  const rows = [
    { id: 1, player_name: "田澄云", birthDate: "2018-08-01", average: "10.130", personal_best: "9.740" },
    { id: 2, player_name: "黄梓墨", birthDate: "2018-09-01", average: "10.560", personal_best: "8.300" },
    { id: 3, player_name: "刘淅杰", birthDate: "2018-07-03", average: "14.890", personal_best: "12.610" },
    { id: 4, player_name: "韩迦南", birthDate: "2019-01-31", average: "19.030", personal_best: "17.420" }
  ];
  assert.equal(getWeeklyRankingAgeGroup("2018-07-03", "", new Date("2026-06-29T00:00:00")), "U8");
  assert.equal(getWeeklyRankingAgeGroup("2018-07-03", "", new Date("2026-09-08T00:00:00")), "U10");
  const ranks = buildWeeklyRankAssignments(
    rows,
    (row) => getWeeklyRankingAgeGroup(row.birthDate, "", new Date("2026-06-29T00:00:00")),
    getWeeklyRankingAgeGroupOrder
  );

  assert.deepEqual(ranks, [
    { id: 1, rank: 1 },
    { id: 2, rank: 2 },
    { id: 3, rank: 3 },
    { id: 4, rank: 4 }
  ]);
});
