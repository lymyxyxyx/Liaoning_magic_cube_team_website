import type { ResultValue } from "./weekly-result-utils";

type WeeklyOverallRankingRow = {
  rank: number;
  sourceRank: number | null;
  average: ResultValue;
  best: ResultValue;
  player: { name: string };
};

export function buildWeeklyOverallRanking<T extends WeeklyOverallRankingRow>(rows: T[], higherIsBetter = false): T[] {
  return [...rows].sort((a, b) => {
    return compareScore(a.average, b.average, higherIsBetter) || compareScore(a.best, b.best, higherIsBetter) || a.player.name.localeCompare(b.player.name, "zh-CN");
  }).map((row, index) => ({ ...row, rank: index + 1 }));
}

function compareScore(a: ResultValue, b: ResultValue, higherIsBetter: boolean) {
  const scoreA = typeof a === "number" && Number.isFinite(a) && a >= 0 ? (higherIsBetter ? -a : a) : Number.POSITIVE_INFINITY;
  const scoreB = typeof b === "number" && Number.isFinite(b) && b >= 0 ? (higherIsBetter ? -b : b) : Number.POSITIVE_INFINITY;
  return scoreA - scoreB;
}
