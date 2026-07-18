import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { getWeeklyMeets } from "@/lib/weekly-db";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";

export const dynamic = "force-dynamic";

export default async function WeeklyHistoryPage() {
  if (!isWeeklyCompetitionEnabled()) notFound();
  const meets = await getWeeklyMeets();

  return (
    <>
      <PageHero
        className="page-hero--compact weekly-results-page-hero"
        label="周赛历史"
        title="历史周赛"
        actions={<Link className="button" href="/weekly/results">返回本周成绩</Link>}
      >
        以下历史周赛数据属于旧系统遗留数据，正在重新适配；历史成绩和选手信息可能暂不完整，不影响当前周录入。
      </PageHero>
      <section className="container section">
        {meets.length === 0 ? <p className="empty-state">暂无已发布的历史周赛。</p> : null}
        <div className="weekly-list">
          {meets.map((meet) => (
            <Link className="weekly-list-item" href={`/weekly/${meet.slug}`} key={meet.id}>
              <span>
                <strong>第{meet.weekNumber}周 · {meet.title}</strong>
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
