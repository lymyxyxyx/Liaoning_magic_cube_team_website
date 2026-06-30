import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { getAnalyticsSummary, type AnalyticsSummary } from "@/lib/analytics-store";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  let summary: AnalyticsSummary | null = null;
  let error = "";

  try {
    summary = await getAnalyticsSummary();
  } catch {
    error = "暂时无法读取访问统计，请确认数据库已初始化。";
  }

  return (
    <>
      <PageHero
        label="后台管理"
        title="访问统计"
        actions={
          <Link className="button" href="/admin">
            返回后台首页
          </Link>
        }
      >
        查看本站访问人次、最近趋势和热门页面。统计仅在后台展示。
      </PageHero>
      <section className="container section admin-console-shell">
        {summary ? <AnalyticsDashboard summary={summary} /> : <p className="admin-inline-notice">{error}</p>}
      </section>
    </>
  );
}

function AnalyticsDashboard({ summary }: { summary: AnalyticsSummary }) {
  const metrics = [
    { label: "总访问量", value: summary.totalViews },
    { label: "今日访问量", value: summary.todayViews },
    { label: "昨日访问量", value: summary.yesterdayViews },
    { label: "近 7 天", value: summary.last7DaysViews }
  ];

  return (
    <div className="analytics-dashboard">
      <div className="analytics-metric-grid">
        {metrics.map((metric) => (
          <article className="admin-card analytics-metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{formatNumber(metric.value)}</strong>
          </article>
        ))}
      </div>

      <div className="grid two analytics-grid">
        <article className="admin-card">
          <div className="admin-card-heading">
            <div>
              <h2>最近 7 天</h2>
              <p>按自然日统计的页面访问人次。</p>
            </div>
          </div>
          <div className="analytics-bars">
            {summary.dailyViews.map((day) => (
              <div className="analytics-bar-row" key={day.date}>
                <span>{formatDay(day.date)}</span>
                <div>
                  <i style={{ width: `${getBarWidth(day.views, summary.dailyViews.map((item) => item.views))}%` }} />
                </div>
                <strong>{formatNumber(day.views)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-card">
          <div className="admin-card-heading">
            <div>
              <h2>热门页面</h2>
              <p>最近 30 天访问量最高的页面。</p>
            </div>
          </div>
          {summary.topPages.length > 0 ? (
            <div className="analytics-page-list">
              {summary.topPages.map((page) => (
                <div className="analytics-page-row" key={page.path}>
                  <span>{page.path}</span>
                  <strong>{formatNumber(page.views)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-inline-notice">暂无访问记录。</p>
          )}
        </article>
      </div>
    </div>
  );
}

function getBarWidth(value: number, values: number[]) {
  const max = Math.max(...values, 1);
  return Math.max(4, Math.round((value / max) * 100));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDay(value: string) {
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(date);
}
