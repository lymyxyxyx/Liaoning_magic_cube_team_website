import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { getWeeklyMeets } from "@/lib/weekly-db";

export const dynamic = "force-dynamic";

function getCurrentWeekStatus(now = new Date()) {
  const current = new Date(now);
  const day = current.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(current);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(current.getDate() - daysFromMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const pad = (value: number) => String(value).padStart(2, "0");
  const format = (date: Date) =>
    `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const total = sunday.getTime() - monday.getTime();
  const remaining = sunday.getTime() - current.getTime();
  const remainingPercent = Math.max(0, Math.min(100, Math.round((remaining / total) * 100)));

  return {
    dateRange: `${format(monday)}-${format(sunday)}`,
    remainingPercent
  };
}

export default async function WeeklyPage() {
  const weeklyMeets = await getWeeklyMeets();
  const latestWeekNumber = weeklyMeets.length > 0 ? Math.max(...weeklyMeets.map((m) => m.weekNumber)) : 328;
  const currentWeekNumber = latestWeekNumber + 1;
  const currentWeekStatus = getCurrentWeekStatus();
  const earliestWeekNumber = weeklyMeets.length > 0 ? Math.min(...weeklyMeets.map((m) => m.weekNumber)) : 1;
  const previousWeeks = Array.from({ length: earliestWeekNumber - 1 }, (_, i) => earliestWeekNumber - 1 - i);

  return (
    <>
      <PageHero className="page-hero--compact weekly-page-hero" label="线上周赛" title="辽宁魔方线上周赛">
        面向辽宁所有魔方爱好者开放，不限年龄与地区，一起记录每周进步。
      </PageHero>

      <section className="container section weekly-home-section">
        <Link className="weekly-feature weekly-feature--test" href="/weekly/results">
          <div>
            <h2>
              当前周赛（第{currentWeekNumber}周）
              <small>{currentWeekStatus.dateRange}</small>
            </h2>
            <div className="weekly-current-progress" aria-label={`本周剩余 ${currentWeekStatus.remainingPercent}%`}>
              <span>
                <i style={{ width: `${currentWeekStatus.remainingPercent}%` }} />
              </span>
              <em>剩余 {currentWeekStatus.remainingPercent}%</em>
            </div>
          </div>
          <strong>立即参加</strong>
        </Link>

        {weeklyMeets.length > 0 || previousWeeks.length > 0 ? (
          <details className="weekly-history-fold">
            <summary>
              <div>
                <strong>历史周赛</strong>
                <small>
                  已发布 {weeklyMeets.length} 期，旧内容已收起
                </small>
              </div>
              <span>展开</span>
            </summary>

            {weeklyMeets.length > 0 ? (
              <div className="recorded-week-list">
                {weeklyMeets.map((meet) => (
                  <Link className="recorded-week-card" href={`/weekly/${meet.slug}`} key={meet.id}>
                    <span>{meet.title}</span>
                    <small>{meet.publishedAt ? `发布时间：${meet.publishedAt}` : meet.dateLabel}</small>
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="weekly-list">
              {previousWeeks.map((weekNumber) => (
                <div className="weekly-list-item pending" key={weekNumber}>
                  <span>辽宁魔方线上周赛第{weekNumber}周总结</span>
                  <small>待录入</small>
                </div>
              ))}
            </div>
          </details>
        ) : null}

        <div className="weekly-secondary-links">
          <Link className="button button--ghost" href="/weekly/big-stack">
            单轮大堆纪录
          </Link>
        </div>
      </section>
    </>
  );
}
