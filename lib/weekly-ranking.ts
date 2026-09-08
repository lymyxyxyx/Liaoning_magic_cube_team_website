export type WeeklyRankingRow = {
  id: number;
  player_name: string;
  average: string;
  personal_best: string;
};

export function buildWeeklyRankAssignments<T extends WeeklyRankingRow>(
  rows: T[],
  getGroup: (row: T) => string,
  getGroupOrder: (group: string) => number
) {
  const ranked = rows.map((row) => ({ row, group: getGroup(row) }));
  ranked.sort((a, b) => {
    const groupOrder = getGroupOrder(a.group) - getGroupOrder(b.group);
    if (groupOrder !== 0) return groupOrder;
    const averageA = Number(a.row.average);
    const averageB = Number(b.row.average);
    const averageOrder = (averageA < 0 ? 1 : 0) - (averageB < 0 ? 1 : 0) || averageA - averageB;
    if (averageOrder !== 0) return averageOrder;
    const bestA = Number(a.row.personal_best);
    const bestB = Number(b.row.personal_best);
    const bestOrder = (bestA < 0 ? 1 : 0) - (bestB < 0 ? 1 : 0) || bestA - bestB;
    return bestOrder || a.row.player_name.localeCompare(b.row.player_name, "zh-CN");
  });

  const rankByGroup = new Map<string, number>();
  return ranked.map(({ row, group }) => {
    const rank = (rankByGroup.get(group) || 0) + 1;
    rankByGroup.set(group, rank);
    return { id: row.id, rank };
  });
}
