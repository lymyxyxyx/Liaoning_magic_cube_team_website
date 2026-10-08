type PbRow = { id: number; best: number; average: number };

/** Rows must be in meet-date order. A PB badge means a strict improvement
 * over the historical baseline and all earlier weekly results. */
export function buildWeeklyPbHistory(rows: PbRow[], baseBest: number | null, baseAverage: number | null, higherIsBetter = false) {
  let best = valid(baseBest) ? baseBest : null;
  let average = valid(baseAverage) ? baseAverage : null;
  const flags = rows.map((row) => {
    const pbRefreshed = better(row.best, best, higherIsBetter);
    const pbAverageRefreshed = better(row.average, average, higherIsBetter);
    if (pbRefreshed) best = row.best;
    if (pbAverageRefreshed) average = row.average;
    return { id: row.id, pbRefreshed, pbAverageRefreshed };
  });
  return { best, average, flags };
}

function valid(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}

function better(value: number, previous: number | null, higherIsBetter: boolean) {
  return valid(value) && (previous === null || (higherIsBetter ? value > previous : value < previous));
}
