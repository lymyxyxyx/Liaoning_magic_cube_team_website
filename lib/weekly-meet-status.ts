export type WeeklyMeetStatus = "draft" | "open" | "closed" | "archived";

type TimedWeeklyMeet = {
  startsAt?: string | null;
  endsAt?: string | null;
  status?: string | null;
};

/**
 * The weekly window is the source of truth.  The persisted status remains a
 * useful snapshot for administration, but must never decide whether a meet is
 * current or has already ended.
 */
export function getWeeklyMeetStatus(meet: TimedWeeklyMeet, now = Date.now()): WeeklyMeetStatus {
  const startsAt = parseTime(meet.startsAt);
  const endsAt = parseTime(meet.endsAt);

  if (startsAt !== null && now < startsAt) return "draft";
  if (endsAt !== null && now > endsAt) return "closed";
  if (startsAt !== null || endsAt !== null) return "open";

  return meet.status === "archived" ? "archived" : "draft";
}

export function isWeeklyMeetCurrent(meet: TimedWeeklyMeet, now = Date.now()) {
  return getWeeklyMeetStatus(meet, now) === "open";
}

export function weeklyMeetStatusLabel(status: string | null | undefined) {
  if (status === "open") return "进行中";
  if (status === "closed") return "已结束";
  if (status === "archived") return "已归档";
  return "未开始";
}

function parseTime(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}
