import { getPostgresPool } from "@/lib/postgres";

export type AnalyticsSummary = {
  totalViews: number;
  todayViews: number;
  yesterdayViews: number;
  last7DaysViews: number;
  topPages: AnalyticsPageStat[];
  dailyViews: AnalyticsDailyStat[];
  recentViews: AnalyticsRecentView[];
};

export type AnalyticsPageStat = {
  path: string;
  views: number;
};

export type AnalyticsDailyStat = {
  date: string;
  views: number;
};

export type AnalyticsRecentView = {
  path: string;
  visitorIp: string;
  deviceType: string;
  createdAt: string;
};

type CountRow = {
  count: string | number;
};

type PageRow = {
  path: string;
  views: string | number;
};

type DailyRow = {
  date: string;
  views: string | number;
};

type RecentViewRow = {
  path: string;
  visitor_ip: string;
  device_type: string;
  created_at: string;
};

let analyticsTableReady: Promise<void> | undefined;

export async function ensureAnalyticsTable() {
  analyticsTableReady ??= getPostgresPool()
    .query(
      `
        CREATE TABLE IF NOT EXISTS page_views (
          id BIGSERIAL PRIMARY KEY,
          path TEXT NOT NULL,
          referrer TEXT NOT NULL DEFAULT '',
          user_agent TEXT NOT NULL DEFAULT '',
          visitor_ip TEXT NOT NULL DEFAULT '',
          device_type TEXT NOT NULL DEFAULT 'unknown',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
    )
    .then(async () => {
      await getPostgresPool().query("ALTER TABLE page_views ADD COLUMN IF NOT EXISTS visitor_ip TEXT NOT NULL DEFAULT ''");
      await getPostgresPool().query("CREATE INDEX IF NOT EXISTS page_views_created_at_idx ON page_views (created_at)");
      await getPostgresPool().query("CREATE INDEX IF NOT EXISTS page_views_path_idx ON page_views (path)");
    })
    .then(() => undefined);
  return analyticsTableReady;
}

export async function recordPageView(input: { path: string; referrer?: string; userAgent?: string; visitorIp?: string }) {
  await ensureAnalyticsTable();
  const path = normalizePath(input.path);
  if (!path || shouldSkipPath(path)) return;

  const userAgent = (input.userAgent || "").slice(0, 500);
  const visitorIp = normalizeIp(input.visitorIp || "");
  await getPostgresPool().query(
    `
      INSERT INTO page_views (path, referrer, user_agent, visitor_ip, device_type)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [path, (input.referrer || "").slice(0, 500), userAgent, visitorIp, getDeviceType(userAgent)]
  );
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  await ensureAnalyticsTable();
  const pool = getPostgresPool();
  const [total, today, yesterday, last7Days, topPages, dailyViews, recentViews] = await Promise.all([
    pool.query<CountRow>("SELECT COUNT(*)::int AS count FROM page_views"),
    pool.query<CountRow>("SELECT COUNT(*)::int AS count FROM page_views WHERE created_at >= date_trunc('day', now())"),
    pool.query<CountRow>(
      `
        SELECT COUNT(*)::int AS count
        FROM page_views
        WHERE created_at >= date_trunc('day', now()) - interval '1 day'
          AND created_at < date_trunc('day', now())
      `
    ),
    pool.query<CountRow>("SELECT COUNT(*)::int AS count FROM page_views WHERE created_at >= now() - interval '7 days'"),
    pool.query<PageRow>(
      `
        SELECT path, COUNT(*)::int AS views
        FROM page_views
        WHERE created_at >= now() - interval '30 days'
        GROUP BY path
        ORDER BY views DESC, path ASC
        LIMIT 10
      `
    ),
    pool.query<DailyRow>(
      `
        SELECT to_char(day, 'YYYY-MM-DD') AS date, COALESCE(count(page_views.id), 0)::int AS views
        FROM generate_series(
          date_trunc('day', now()) - interval '6 days',
          date_trunc('day', now()),
          interval '1 day'
        ) AS day
        LEFT JOIN page_views
          ON page_views.created_at >= day
         AND page_views.created_at < day + interval '1 day'
        GROUP BY day
        ORDER BY day ASC
      `
    ),
    pool.query<RecentViewRow>(
      `
        SELECT
          path,
          visitor_ip,
          device_type,
          to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD HH24:MI:SS') AS created_at
        FROM page_views
        ORDER BY created_at DESC
        LIMIT 30
      `
    )
  ]);

  return {
    totalViews: toNumber(total.rows[0]?.count),
    todayViews: toNumber(today.rows[0]?.count),
    yesterdayViews: toNumber(yesterday.rows[0]?.count),
    last7DaysViews: toNumber(last7Days.rows[0]?.count),
    topPages: topPages.rows.map((row) => ({ path: row.path, views: toNumber(row.views) })),
    dailyViews: dailyViews.rows.map((row) => ({ date: row.date, views: toNumber(row.views) })),
    recentViews: recentViews.rows.map((row) => ({
      path: row.path,
      visitorIp: row.visitor_ip || "未知",
      deviceType: row.device_type || "unknown",
      createdAt: row.created_at
    }))
  };
}

function normalizePath(path: string) {
  try {
    const parsed = path.startsWith("http") ? new URL(path) : new URL(path, "https://lncubing.com");
    return `${parsed.pathname}${parsed.search}`.slice(0, 500);
  } catch {
    return path.split("#")[0].slice(0, 500);
  }
}

function shouldSkipPath(path: string) {
  return (
    path.startsWith("/admin") ||
    path.startsWith("/api") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml"
  );
}

function getDeviceType(userAgent: string) {
  const value = userAgent.toLowerCase();
  if (/mobile|iphone|android/.test(value)) return "mobile";
  if (/ipad|tablet/.test(value)) return "tablet";
  if (!value) return "unknown";
  return "desktop";
}

function normalizeIp(value: string) {
  const ip = value.trim().replace(/^\[|\]$/g, "");
  if (!ip) return "";
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) return ip.slice(0, ip.lastIndexOf(":"));
  return ip.slice(0, 100);
}

function toNumber(value: string | number | undefined) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}
