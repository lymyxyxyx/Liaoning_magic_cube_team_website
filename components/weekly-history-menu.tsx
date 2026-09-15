import Link from "next/link";
import type { WeeklyMeetOption } from "@/lib/weekly-entry-store";
import { getWeeklyMeetMenuLabel } from "@/lib/weekly-meet-label";

type WeeklyMenuMeet = Pick<WeeklyMeetOption, "dateLabel" | "endsAt" | "startsAt" | "status">;

function getDateParts(value: string) {
  const matches = [...value.matchAll(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/g)];
  return matches.map((match) => ({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  }));
}

function formatMenuDate({ month, day }: { month: number; day: number }) {
  return `${month}月${day}日`;
}

function getWeeklyMenuPeriod(meet: WeeklyMenuMeet) {
  // The date label is the operator-confirmed weekly range. It also keeps
  // historical rows consistent with older records that used different
  // timezone storage conventions for starts_at / ends_at.
  const dates = getDateParts(meet.dateLabel);
  if (dates.length >= 2) {
    return `${formatMenuDate(dates[0])} 0:00–${formatMenuDate(dates[dates.length - 1])} 24:00`;
  }
  return meet.dateLabel || "日期待定";
}

function isMeetInProgress(meet: WeeklyMenuMeet, now = new Date()) {
  if (meet.status !== "open") return false;
  const dates = getDateParts(meet.dateLabel);
  if (dates.length >= 2) {
    const start = new Date(`${dates[0].year}-${String(dates[0].month).padStart(2, "0")}-${String(dates[0].day).padStart(2, "0")}T00:00:00+08:00`);
    const endDate = dates[dates.length - 1];
    const end = new Date(`${endDate.year}-${String(endDate.month).padStart(2, "0")}-${String(endDate.day).padStart(2, "0")}T00:00:00+08:00`);
    end.setUTCDate(end.getUTCDate() + 1);
    return start <= now && now < end;
  }
  const start = meet.startsAt ? new Date(meet.startsAt) : null;
  const end = meet.endsAt ? new Date(meet.endsAt) : null;
  return (!start || start <= now) && (!end || now <= end);
}

export function WeeklyHistoryMenu({ meets }: { meets: WeeklyMeetOption[] }) {
  return (
    <details className="weekly-history-menu">
      <summary>周赛列表</summary>
      <div>
        {meets.map((meet) => {
          const inProgress = isMeetInProgress(meet);
          return (
          <Link className={inProgress ? "is-in-progress" : undefined} href={`/weekly/${meet.slug}`} key={meet.id}>
            <span className="weekly-history-menu-title">
              {getWeeklyMeetMenuLabel(meet.title)}
              {inProgress ? <strong className="weekly-history-menu-status">进行中</strong> : null}
            </span>
            <small className="weekly-history-menu-period">{getWeeklyMenuPeriod(meet)}</small>
          </Link>
          );
        })}
        {meets.length === 0 ? <span className="weekly-history-empty">暂无周赛</span> : null}
      </div>
    </details>
  );
}
