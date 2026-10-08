type EntryPeriod = { startsAt?: string | null; endsAt?: string | null; dateLabel?: string };

const shanghaiDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
});

export function formatWeeklyEntryPeriod(meet: EntryPeriod) {
  if (!meet.startsAt || !meet.endsAt) return meet.dateLabel || "日期待定";
  const start = formatDateTime(meet.startsAt);
  const end = formatDateTime(meet.endsAt, true);
  if (!start || !end) return meet.dateLabel || "日期待定";
  return `北京时间 ${start} 开放 · ${end} 截止`;
}

function formatDateTime(value: string, inclusiveEnd = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(shanghaiDateTime.formatToParts(date).map((part) => [part.type, part.value]));
  const time = inclusiveEnd && parts.hour === "23" && parts.minute === "59" && parts.second === "59"
    ? "24:00" : `${parts.hour}:${parts.minute}`;
  return `${Number(parts.year)}年${Number(parts.month)}月${Number(parts.day)}日 ${time}`;
}
