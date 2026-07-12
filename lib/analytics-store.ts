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
  visitorLocation: string;
  visitorLocationZh: string;
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
  visitor_location: string;
  visitor_location_zh: string;
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
          visitor_location TEXT NOT NULL DEFAULT '',
          visitor_location_zh TEXT NOT NULL DEFAULT '',
          device_type TEXT NOT NULL DEFAULT 'unknown',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
    )
    .then(async () => {
      await getPostgresPool().query("ALTER TABLE page_views ADD COLUMN IF NOT EXISTS visitor_ip TEXT NOT NULL DEFAULT ''");
      await getPostgresPool().query("ALTER TABLE page_views ADD COLUMN IF NOT EXISTS visitor_location TEXT NOT NULL DEFAULT ''");
      await getPostgresPool().query("ALTER TABLE page_views ADD COLUMN IF NOT EXISTS visitor_location_zh TEXT NOT NULL DEFAULT ''");
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
  const cachedLocations = await getCachedLocations(visitorIp);
  const [visitorLocation, visitorLocationZh] = cachedLocations
    ? [cachedLocations.location, cachedLocations.locationZh]
    : await Promise.all([resolveIpLocation(visitorIp), resolveIpLocation(visitorIp, "zh-CN")]);
  await getPostgresPool().query(
      `
      INSERT INTO page_views (path, referrer, user_agent, visitor_ip, visitor_location, visitor_location_zh, device_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [path, (input.referrer || "").slice(0, 500), userAgent, visitorIp, visitorLocation, visitorLocationZh, getDeviceType(userAgent)]
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
          visitor_location,
          visitor_location_zh,
          device_type,
          to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD HH24:MI:SS') AS created_at
        FROM page_views
        ORDER BY created_at DESC
        LIMIT 30
      `
    )
  ]);

  const resolvedLocations = await resolveRecentLocations(recentViews.rows);
  const resolvedChineseLocations = await resolveRecentLocations(recentViews.rows, "zh-CN");

  return {
    totalViews: toNumber(total.rows[0]?.count),
    todayViews: toNumber(today.rows[0]?.count),
    yesterdayViews: toNumber(yesterday.rows[0]?.count),
    last7DaysViews: toNumber(last7Days.rows[0]?.count),
    topPages: topPages.rows.map((row) => ({ path: row.path, views: toNumber(row.views) })),
    dailyViews: dailyViews.rows.map((row) => ({ date: row.date, views: toNumber(row.views) })),
    recentViews: recentViews.rows.map((row) => ({
      path: row.path,
      visitorIp: row.visitor_ip || "未记录",
      visitorLocation: resolvedLocations.get(row.visitor_ip) || row.visitor_location || "未知",
      visitorLocationZh: resolvedChineseLocations.get(row.visitor_ip) || row.visitor_location_zh || "未知",
      deviceType: row.device_type || "unknown",
      createdAt: row.created_at
    }))
  };
}

async function getCachedLocations(ip: string) {
  if (!ip) return null;
  const { rows } = await getPostgresPool().query<{ visitor_location: string; visitor_location_zh: string }>(
    `
      SELECT visitor_location, visitor_location_zh
      FROM page_views
      WHERE visitor_ip = $1 AND visitor_location <> '' AND visitor_location_zh <> ''
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [ip]
  );
  const row = rows[0];
  return row ? { location: row.visitor_location, locationZh: row.visitor_location_zh } : null;
}

async function resolveRecentLocations(rows: RecentViewRow[], language?: "zh-CN") {
  const field = language ? "visitor_location_zh" : "visitor_location";
  const locations = new Map(rows.map((row) => [row.visitor_ip, row[field]]));
  const pendingIps = Array.from(
    new Set(rows.map((row) => row.visitor_ip).filter((ip) => ip && !locations.get(ip)))
  );
  if (pendingIps.length === 0) return locations;

  const resolved = await Promise.all(pendingIps.map(async (ip) => [ip, await resolveIpLocation(ip, language)] as const));
  await Promise.all(
    resolved.map(async ([ip, location]) => {
      locations.set(ip, location);
      await getPostgresPool().query(`UPDATE page_views SET ${field} = $1 WHERE visitor_ip = $2 AND ${field} = ''`, [
        location,
        ip
      ]);
    })
  );
  return locations;
}

async function resolveIpLocation(ip: string, language?: "zh-CN") {
  if (!ip) return "未记录";
  if (isPrivateIp(ip)) return "内网地址";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);
  try {
    const searchParams = new URLSearchParams({ fields: "success,country,region,city" });
    if (language) searchParams.set("lang", language);
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?${searchParams}`, {
      signal: controller.signal,
      cache: "no-store"
    });
    if (!response.ok) return "未知";
    const payload = (await response.json()) as { success?: boolean; country?: string; region?: string; city?: string };
    if (!payload.success) return "未知";
    return [payload.country, payload.region, payload.city].filter(Boolean).join(" · ") || "未知";
  } catch {
    return "未知";
  } finally {
    clearTimeout(timeout);
  }
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

function isPrivateIp(ip: string) {
  return (
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip.startsWith("fc") ||
    ip.startsWith("fd")
  );
}

function toNumber(value: string | number | undefined) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}
