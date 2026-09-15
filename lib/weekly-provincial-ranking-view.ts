export type WeeklyProvincialRankableRow = {
  rank: number;
  average: number;
  ageGroup: string;
};

/**
 * Filter the already score-ordered provincial ranking and rebuild RANK-style
 * positions inside the selected historical age group. Equal averages share a
 * rank and leave the same gap as PostgreSQL RANK().
 */
export function buildWeeklyProvincialRankingView<T extends WeeklyProvincialRankableRow>(rows: T[], selectedAgeGroup: string): T[] {
  if (!selectedAgeGroup) return rows;

  let previousAverage: number | null = null;
  let currentRank = 0;
  return rows
    .filter((row) => row.ageGroup === selectedAgeGroup)
    .map((row, index) => {
      if (previousAverage === null || row.average !== previousAverage) currentRank = index + 1;
      previousAverage = row.average;
      return { ...row, rank: currentRank };
    });
}
