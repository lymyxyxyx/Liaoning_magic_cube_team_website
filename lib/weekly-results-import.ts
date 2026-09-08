import { calculateResultByFormat, formatResult, getWeeklyResultFormat, parseResultInput, type ResultValue } from "@/lib/weekly-result-utils";

export type NormalizedWeeklyResultRow = {
  eventCode: string;
  playerId: string;
  wcaId: string;
  playerName: string;
  attempts: ResultValue[];
  notes: string;
  sourceRow: number;
  warnings: string[];
  errors: string[];
  matchedPlayerId: string;
  matchStatus: "player_id" | "wca_id" | "exact_name" | "ambiguous_name" | "similar_name" | "unmatched";
  best: ResultValue | null;
  average: ResultValue | null;
};

export function normalizePastedWeeklyResults(text: string, defaults: { eventCode: string; format: string }) {
  const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim());
  return lines.map((line, index) => {
    const values = line.split("\t").map((value) => value.trim());
    const hasIdentityColumns = values.length >= 8;
    const [playerId, wcaId, playerName, ...attemptValues] = hasIdentityColumns ? values : ["", "", values[0] || "", ...values.slice(1)];
    return normalizeWeeklyResultRow({ eventCode: defaults.eventCode, playerId, wcaId, playerName, attemptValues, notes: "", sourceRow: index + 1, format: defaults.format });
  });
}

export function normalizeWeeklyResultRow(input: { eventCode: string; playerId?: string; wcaId?: string; playerName?: string; attemptValues: unknown[]; notes?: string; sourceRow: number; format: string }): NormalizedWeeklyResultRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const format = getWeeklyResultFormat(input.format);
  const eventCode = input.eventCode.trim();
  if (!eventCode) errors.push("缺少 event_code");
  const attemptValues = input.attemptValues.slice(0, format.attemptCount);
  if (input.attemptValues.length !== format.attemptCount) errors.push(`该项目要求 ${format.attemptCount} 次尝试`);
  const attempts: ResultValue[] = [];
  for (const value of attemptValues) {
    try { attempts.push(parseResultInput(String(value ?? ""))); } catch { errors.push("存在空白或格式错误的尝试成绩"); break; }
  }
  let best: ResultValue | null = null;
  let average: ResultValue | null = null;
  if (!errors.length) {
    const calculated = calculateResultByFormat(attempts, format.id);
    best = calculated.best; average = calculated.average;
  }
  return { eventCode, playerId: input.playerId?.trim() || "", wcaId: input.wcaId?.trim().toUpperCase() || "", playerName: input.playerName?.trim() || "", attempts, notes: input.notes?.trim() || "", sourceRow: input.sourceRow, warnings, errors, matchedPlayerId: "", matchStatus: "unmatched", best, average };
}

export function previewResultSummary(rows: NormalizedWeeklyResultRow[]) {
  return { total: rows.length, ready: rows.filter((row) => !row.errors.length && Boolean(row.matchedPlayerId)).length, errors: rows.reduce((n, row) => n + row.errors.length, 0), warnings: rows.reduce((n, row) => n + row.warnings.length, 0), display: rows.map((row) => ({ ...row, bestText: formatResult(row.best), averageText: formatResult(row.average) })) };
}
