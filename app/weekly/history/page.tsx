import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { isGuestVisibleWeeklyMeet } from "@/lib/weekly-guest-history";

export const dynamic = "force-dynamic";

export default async function WeeklyHistoryPage() {
  if (!isWeeklyCompetitionEnabled()) notFound();
  const meets = (await listWeeklyMeetOptions())
    .filter((meet) => isGuestVisibleWeeklyMeet(meet))
    .sort((left, right) => new Date(right.startsAt || 0).getTime() - new Date(left.startsAt || 0).getTime());

  return (
    <>
      <PageHero
        className="page-hero--compact weekly-results-page-hero"
        label="线上周赛"
        title="全部周赛"
        actions={<Link className="button" href="/weekly">返回本周成绩</Link>}
      >
        所有已创建周赛均可查看；没有成绩的周次会显示为空表，成绩录入后自动更新。
      </PageHero>
      <section className="container section">
        {meets.length === 0 ? <p className="empty-state">暂无周赛。</p> : null}
        <div className="weekly-list">
          {meets.map((meet) => (
            <Link className="weekly-list-item" href={`/weekly/${meet.slug}`} key={meet.id}>
              <span>
                <strong>{meet.title}</strong>
                <small>{meet.dateLabel}</small>
              </span>
              <span className="status">查看成绩</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
