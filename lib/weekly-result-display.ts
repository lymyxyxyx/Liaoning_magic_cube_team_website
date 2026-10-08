import type { WeeklyResult } from "@/lib/weekly";

function compareScore(value: number, higherIsBetter: boolean) {
  return Number.isFinite(value) && value >= 0 ? (higherIsBetter ? -value : value) : Number.POSITIVE_INFINITY;
}

export function sortWeeklyResultsByAverage(results: WeeklyResult[], higherIsBetter = false) {
  return [...results].sort((a, b) => {
    if (!higherIsBetter && a.sourceRank !== undefined && b.sourceRank !== undefined) {
      return a.sourceRank - b.sourceRank;
    }

    const averageOrder = compareScore(a.average, higherIsBetter) - compareScore(b.average, higherIsBetter);
    if (averageOrder) return averageOrder;

    const bestOrder = compareScore(a.personalBest, higherIsBetter) - compareScore(b.personalBest, higherIsBetter);
    if (bestOrder) return bestOrder;

    return a.playerName.localeCompare(b.playerName, "zh-CN");
  }).map((row, index) => higherIsBetter ? { ...row, rank: index + 1 } : row);
}
