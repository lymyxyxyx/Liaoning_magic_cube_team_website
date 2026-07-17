import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "周赛",
  description: "辽宁魔方周赛成绩与排名，含每周三阶等项目成绩、个人最好与年龄组别。",
  alternates: { canonical: "/weekly" },
  openGraph: {
    type: "website",
    url: "/weekly",
    title: "周赛",
    description: "辽宁魔方周赛成绩、个人最好与排名。"
  }
};

function getCurrentWeekStatus(endAt?: string | null, now = new Date()) {
  const current = new Date(now);
  if (endAt) {
    const end = new Date(endAt);
    const remaining = end.getTime() - current.getTime();
    return { dateRange: `截止时间：${end.toLocaleString("zh-CN", { hour12: false })}`, remainingPercent: Math.max(0, Math.min(100, Math.round((remaining / (7 * 86400000)) * 100))) };
  }
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
  if (!isWeeklyCompetitionEnabled()) notFound();
  const configuredMeets = await listWeeklyMeetOptions().catch(() => []);
  const currentMeet = configuredMeets.find((meet) => meet.status === "open");
  const currentWeekStatus = getCurrentWeekStatus(currentMeet?.endsAt);

  return (
    <>
      <PageHero className="page-hero--compact weekly-page-hero" label="线上周赛" title="辽宁魔方线上周赛">
        面向辽宁所有魔方爱好者开放，不限年龄与地区，一起记录每周进步。
      </PageHero>

      <section className="container section weekly-home-section">
        {currentMeet ? <Link className="weekly-feature weekly-feature--test" href="/weekly/results">
          <div>
            <h2>
              {currentMeet.title}
              <small>{currentMeet.dateLabel} · {currentWeekStatus.dateRange}</small>
            </h2>
            <div className="weekly-current-progress" aria-label={`本周剩余 ${currentWeekStatus.remainingPercent}%`}>
              <span>
                <i style={{ width: `${currentWeekStatus.remainingPercent}%` }} />
              </span>
              <em>剩余 {currentWeekStatus.remainingPercent}%</em>
            </div>
          </div>
          <strong>立即参加</strong>
        </Link> : <div className="weekly-feature weekly-feature--disabled"><div><h2>本周周赛暂未开放</h2><small>请关注后续公告。</small></div></div>}

        <div className="weekly-secondary-links">
          <Link className="button button--ghost" href="/weekly/big-stack">
            单轮大堆纪录
          </Link>
        </div>
      </section>
    </>
  );
}
