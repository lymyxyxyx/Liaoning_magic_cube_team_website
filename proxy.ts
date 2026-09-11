import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { isGuestWeeklyHistorySlug } from "@/lib/weekly-guest-history";
import { getCanonicalAdminUrl } from "@/lib/site-origin";

const adminCookieName = "liaoning_admin_session";
const adminNextCookieName = "liaoning_admin_next";
const weeklyAdminCookieName = "liaoning_weekly_admin_session";
const weeklyAdminNextCookieName = "liaoning_weekly_next";
const weeklyAccessCookieName = "liaoning_weekly_access_session";

async function hasAdminSession(request: NextRequest) {
  const token = request.cookies.get(adminCookieName)?.value;
  if (!token) return false;
  return verifySessionToken(token, "site-admin");
}

async function hasWeeklyAdminSession(request: NextRequest) {
  const token = request.cookies.get(weeklyAdminCookieName)?.value;
  if (!token) return false;
  return verifySessionToken(token, "weekly-admin");
}

async function hasWeeklyAccessSession(request: NextRequest) {
  const token = request.cookies.get(weeklyAccessCookieName)?.value;
  return Boolean(token && await verifySessionToken(token, "weekly-access"));
}

function isSecureRequest(request: NextRequest) {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

  const isWeeklyLandingPage = pathname === "/weekly" || pathname === "/weekly/";
  const weeklySlug = pathname.match(/^\/weekly\/([^/]+)\/?$/)?.[1] || "";
  const isGuestWeeklyHistoryPage = isGuestWeeklyHistorySlug(weeklySlug);
  const isWeeklyPage = pathname.startsWith("/weekly") && !isWeeklyLandingPage && !isGuestWeeklyHistoryPage && pathname !== "/weekly/results" && pathname !== "/weekly/history" && pathname !== "/weekly/grade-standards" && !pathname.startsWith("/weekly/access") && !pathname.startsWith("/weekly/admin");
  const isWeeklyAdminApi = pathname.startsWith("/api/admin/weekly-");

  const hasWeeklyAccess = await hasWeeklyAccessSession(request);
  const hasWeeklyAdmin = await hasWeeklyAdminSession(request);
  // A weekly administrator may enter the same protected weekly route, but
  // write handlers still require the administrator audience explicitly.
  if (isWeeklyPage && !(hasWeeklyAccess || hasWeeklyAdmin)) {
    const accessUrl = request.nextUrl.clone();
    accessUrl.pathname = "/weekly/access";
    accessUrl.search = "";
    accessUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(accessUrl);
  }

  if (isWeeklyAdminApi && !(await hasWeeklyAdminSession(request))) {
    return NextResponse.json({ message: "请先登录周赛管理员账号" }, { status: 401 });
  }

  if (host.split(":", 1)[0] === "www.lncubing.com" && pathname.startsWith("/admin")) {
    const canonicalUrl = getCanonicalAdminUrl(request.url);
    return NextResponse.redirect(canonicalUrl);
  }

  const isWeeklyAdminPage = pathname === "/admin/weekly" || pathname.startsWith("/admin/weekly/");
  const isWeeklyAdminLoginPage = pathname === "/admin/weekly/login";
  if (isWeeklyAdminPage && !isWeeklyAdminLoginPage && !hasWeeklyAdmin) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/weekly/login";
    loginUrl.search = "";
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(weeklyAdminNextCookieName, `${pathname}${request.nextUrl.search}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureRequest(request),
      maxAge: 60 * 5,
      path: "/"
    });
    return response;
  }

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !isWeeklyAdminPage && !(await hasAdminSession(request))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(adminNextCookieName, `${pathname}${request.nextUrl.search}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureRequest(request),
      maxAge: 60 * 5,
      path: "/"
    });
    return response;
  }

  if (pathname === "/api/account-books" && !(await hasAdminSession(request))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (pathname === "/api/local-profiles" && request.method !== "GET" && !(await hasAdminSession(request))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (pathname === "/api/commercial-teams" && request.method !== "GET" && !(await hasAdminSession(request))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (pathname.startsWith("/api/weekly-admin") && !(await hasWeeklyAdminSession(request))) {
    return NextResponse.json({ message: "请先登录周赛管理员账号" }, { status: 401 });
  }

  if (pathname.startsWith("/api/admin") && !isWeeklyAdminApi && !(await hasAdminSession(request))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/local-profiles",
    "/api/commercial-teams",
    "/api/account-books",
    "/api/admin/:path*",
    "/weekly/:path*",
    "/api/weekly-competitions/:path*",
    "/api/weekly-admin/:path*"
  ]
};
