import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { isGuestWeeklyHistoryMeet } from "@/lib/weekly-guest-history";

export const dynamic = "force-dynamic";

export default async function WeeklyHistoryPage() {
  if (!isWeeklyCompetitionEnabled()) notFound();
  const meets = (await listWeeklyMeetOptions())
    .filter((meet) => isGuestWeeklyHistoryMeet(meet))
    .sort((left, right) => new Date(right.startsAt || 0).getTime() - new Date(left.startsAt || 0).getTime());

  return (
    <>
      <PageHero
        className="page-hero--compact weekly-results-page-hero"
        label="周赛历史"
        title="历史周赛"
        actions={<Link className="button" href="/weekly">返回本周成绩</Link>}
      >
        周赛截止后会自动在此处公开；历史成绩保留当周记录，供选手查询。
      </PageHero>
      <section className="container section">
        {meets.length === 0 ? <p className="empty-state">暂无已发布的历史周赛。</p> : null}
        <div className="weekly-list">
          {meets.map((meet) => (
            <Link className="weekly-list-item" href={`/weekly/${meet.slug}`} key={meet.id}>
              <span>
                <strong>{meet.title}</strong>
                <small>{meet.dateLabel}</small>
              </span>
              <span className="status">已发布</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
