import type { WeeklyResult } from "@/lib/weekly";

function compareScore(value: number) {
  return Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY;
}

export function sortWeeklyResultsByAverage(results: WeeklyResult[]) {
  return [...results].sort((a, b) => {
    if (a.sourceRank !== undefined && b.sourceRank !== undefined) {
      return a.sourceRank - b.sourceRank;
    }

    const averageOrder = compareScore(a.average) - compareScore(b.average);
    if (averageOrder !== 0) return averageOrder;

    const bestOrder = compareScore(a.personalBest) - compareScore(b.personalBest);
    if (bestOrder !== 0) return bestOrder;

    return a.playerName.localeCompare(b.playerName, "zh-CN");
  });
}
