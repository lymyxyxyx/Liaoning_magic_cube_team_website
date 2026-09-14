import Link from "next/link";
import type { WeeklyMeetOption } from "@/lib/weekly-entry-store";
import { getWeeklyMeetMenuLabel } from "@/lib/weekly-meet-label";

export function WeeklyHistoryMenu({ meets }: { meets: WeeklyMeetOption[] }) {
  return (
    <details className="weekly-history-menu">
      <summary>历史周赛</summary>
      <div>
        {meets.map((meet) => (
          <Link href={`/weekly/${meet.slug}`} key={meet.id}>
            {getWeeklyMeetMenuLabel(meet.title)}
          </Link>
        ))}
        {meets.length === 0 ? <span className="weekly-history-empty">暂无历史周赛</span> : null}
      </div>
    </details>
  );
}
