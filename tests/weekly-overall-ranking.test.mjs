import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyOverallRanking } from "../lib/weekly-overall-ranking.ts";

function result(name, ageGroup, rank, average, best, sourceRank = null) {
  return { player: { name, ageGroup }, rank, average, best, sourceRank };
}

test("all-age results replace repeated group ranks with overall positions", () => {
  const rows = [
    result("韩沐廷", "U8", 1, 1633, 1119),
    result("王曦", "U10", 1, 1370, 1027),
    result("王琬乔", "U8", 2, 1780, 1231),
    result("吴秋铜", "U18", 1, 1479, 1334)
  ];
  const original = structuredClone(rows);
  const ranked = buildWeeklyOverallRanking(rows);
  assert.deepEqual(ranked.map(({ player, rank }) => [player.name, rank]), [
    ["王曦", 1], ["吴秋铜", 2], ["韩沐廷", 3], ["王琬乔", 4]
  ]);
  assert.deepEqual(rows, original);
  assert.equal(ranked.filter((row) => row.player.name === "韩沐廷")[0].rank, 3);
});

test("overall ordering uses best as the average tiebreaker and puts invalid results last", () => {
  const ranked = buildWeeklyOverallRanking([
    result("DNS", "U8", 1, "DNS", "DNS"),
    result("较慢单次", "U8", 2, 1200, 1100),
    result("DNF", "U10", 1, "DNF", 900),
    result("较快单次", "U10", 2, 1200, 1000)
  ]);
  assert.deepEqual(ranked.map(({ player, rank }) => [player.name, rank]), [
    ["较快单次", 1], ["较慢单次", 2], ["DNF", 3], ["DNS", 4]
  ]);
});

test("overall ranking ignores imported ranks from separate age groups", () => {
  const ranked = buildWeeklyOverallRanking([
    result("第二名", "U8", 1, 1000, 800, 2),
    result("第一名", "U10", 1, 1000, 900, 1)
  ]);
  assert.deepEqual(ranked.map(({ player, rank }) => [player.name, rank]), [["第二名", 1], ["第一名", 2]]);
});


test("big-stack overall ranks use larger counts first and keep invalid results last", () => {
  const ranked = buildWeeklyOverallRanking([
    result("少", "U8", 1, 10000, 10000, 1),
    result("DNF", "U8", 2, "DNF", "DNF"),
    result("多", "U10", 1, 12000, 12000, 2),
    result("零", "U10", 2, 0, 0)
  ], true);
  assert.deepEqual(ranked.map(({ player, rank }) => [player.name, rank]), [["多", 1], ["少", 2], ["零", 3], ["DNF", 4]]);
});


test("age-group ranking is recalculated before name search", () => {
  const rows = [
    result("甲", "U8", 8, 1600, 1100, 8),
    result("乙", "U10", 1, 1200, 900, 1),
    result("丙", "U8", 3, 1400, 1000, 3)
  ];
  const ranked = buildWeeklyOverallRanking(rows.filter((row) => row.player.ageGroup === "U8"));
  assert.deepEqual(ranked.map(({ player, rank }) => [player.name, rank]), [["丙", 1], ["甲", 2]]);
  assert.equal(ranked.filter((row) => row.player.name === "甲")[0].rank, 2);
});

test("mixed imported and newly entered results sort consistently by score", () => {
  const rows = [
    result("慢", "U8", 1, 1800, 1500, 1),
    result("中", "U8", 2, 1400, 1100),
    result("快", "U10", 3, 1000, 800, 3)
  ];
  for (const input of [rows, [...rows].reverse(), [rows[1], rows[2], rows[0]]]) {
    assert.deepEqual(buildWeeklyOverallRanking(input).map(({ player, rank }) => [player.name, rank]), [["快", 1], ["中", 2], ["慢", 3]]);
  }
});
