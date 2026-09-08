export const WEEKLY_BUSINESS_TIME_ZONE = "Asia/Shanghai";

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

export function weeklyBusinessDate(value: string | Date | null) {
  if (!value) return "";
  if (typeof value === "string" && dateOnly.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: WEEKLY_BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export function weeklyImportDateWarnings(metadata: Record<string, string>, meet: { startDate: string; endDate: string }) {
  return metadata.start_date !== meet.startDate || metadata.end_date !== meet.endDate
    ? ["比赛信息日期与当前周赛不同"]
    : [];
}
