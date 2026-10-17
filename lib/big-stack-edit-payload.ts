import type { BigStackRecord } from "@/lib/big-stack";

/** Display matches are not identity changes; only explicit edits may bind a player. */
export function buildBigStackEditPayload(record: BigStackRecord, weeklyNumber: string, identityEdited: boolean, reason: string) {
  return {
    name: record.name,
    eventId: record.eventId,
    solveCount: record.solveCount,
    playerId: record.playerId,
    wcaId: record.wcaId,
    achievedAt: record.achievedAt,
    meetId: record.meetId,
    sourceLabel: record.sourceLabel,
    note: record.note,
    genderOverride: record.genderOverride,
    expectedVersion: record.version,
    reason: reason || "大堆榜直接编辑",
    ...(identityEdited ? {
      weeklyNumber: weeklyNumber.trim() ? Number(weeklyNumber) : null,
      playerVersion: record.playerVersion
    } : {})
  };
}
