import type { WeeklyResult } from "@/lib/weekly";

function compareScore(value: number, higherIsBetter: boolean) {
  return Number.isFinite(value) && value >= 0 ? (higherIsBetter ? -value : value) : Number.POSITIVE_INFINITY;
}

export function sortWeeklyResultsByAverage(results: WeeklyResult[], higherIsBetter = false) {
  return [...results].sort((a, b) => {
    const averageOrder = compareScore(a.average, higherIsBetter) - compareScore(b.average, higherIsBetter);
    if (averageOrder) return averageOrder;

    const bestOrder = compareScore(roundBest(a), higherIsBetter) - compareScore(roundBest(b), higherIsBetter);
    if (bestOrder) return bestOrder;

    return a.playerName.localeCompare(b.playerName, "zh-CN");
  }).map((row, index) => ({ ...row, rank: index + 1 }));
}

function roundBest(row: WeeklyResult) {
  if (!row.attempts?.length) return row.personalBest;
  const valid = row.attempts.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);
  return valid.length ? Math.min(...valid) : -1;
}
