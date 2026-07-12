import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { getAnalyticsSummary, type AnalyticsSummary } from "@/lib/analytics-store";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage({ searchParams }: { searchParams?: { page?: string | string[] } }) {
  let summary: AnalyticsSummary | null = null;
  let error = "";
  const pageValue = Array.isArray(searchParams?.page) ? searchParams?.page[0] : searchParams?.page;
  const page = Math.max(1, Number(pageValue || 1) || 1);

  try {
    summary = await getAnalyticsSummary(page);
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
        查看本站访问人次、最近趋势、热门页面和最近访问 IP。统计仅在后台展示。
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

      <article className="admin-card">
        <div className="admin-card-heading">
          <div>
              <h2>全部访问记录</h2>
              <p>按时间倒序展示，每页 50 条，时间按北京时间显示。</p>
          </div>
        </div>
        {summary.recentViews.length > 0 ? (
          <div className="analytics-visit-list">
            <div className="analytics-visit-row analytics-visit-row--head">
              <span>时间</span>
              <span>访问 IP</span>
              <span>归属地</span>
              <span>中文归属地</span>
              <span>设备</span>
              <span>页面</span>
            </div>
            {summary.recentViews.map((view, index) => (
              <div className="analytics-visit-row" key={`${view.createdAt}-${view.path}-${index}`}>
                <span>{view.createdAt}</span>
                <strong>{view.visitorIp}</strong>
                <span>{view.visitorLocation}</span>
                <span>{view.visitorLocationZh}</span>
                <span>{formatDevice(view.deviceType)}</span>
                <span>{view.path}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="admin-inline-notice">暂无访问记录。</p>
        )}
        {summary.recentViewsTotal > summary.recentViewsPageSize ? (
          <nav className="analytics-pagination" aria-label="访问记录分页">
            {summary.recentViewsPage > 1 ? (
              <Link className="button button-secondary" href={`/admin/analytics?page=${summary.recentViewsPage - 1}`}>
                上一页
              </Link>
            ) : (
              <span className="button button-secondary is-disabled">上一页</span>
            )}
            <span>
              第 {summary.recentViewsPage} / {Math.max(1, Math.ceil(summary.recentViewsTotal / summary.recentViewsPageSize))} 页 · 共 {formatNumber(summary.recentViewsTotal)} 条
            </span>
            {summary.recentViewsPage * summary.recentViewsPageSize < summary.recentViewsTotal ? (
              <Link className="button button-secondary" href={`/admin/analytics?page=${summary.recentViewsPage + 1}`}>
                下一页
              </Link>
            ) : (
              <span className="button button-secondary is-disabled">下一页</span>
            )}
          </nav>
        ) : null}
      </article>
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

function formatDevice(value: string) {
  if (value === "mobile") return "移动端";
  if (value === "tablet") return "平板";
  if (value === "desktop") return "桌面端";
  return "未知";
}
