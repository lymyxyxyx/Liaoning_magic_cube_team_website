import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";

const adminCookieName = "liaoning_admin_session";
const adminNextCookieName = "liaoning_admin_next";
const weeklyAdminCookieName = "liaoning_weekly_session";

async function hasAdminSession(request: NextRequest) {
  const token = request.cookies.get(adminCookieName)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

async function hasWeeklyAdminSession(request: NextRequest) {
  const token = request.cookies.get(weeklyAdminCookieName)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

function isSecureRequest(request: NextRequest) {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

  const isWeeklyPage = pathname.startsWith("/weekly") && pathname !== "/weekly/results" && !pathname.startsWith("/weekly/access") && !pathname.startsWith("/weekly/admin");
  const isWeeklyApi = pathname === "/api/weekly-competitions" || pathname.startsWith("/api/weekly-competitions/");
  const isWeeklyResultReadApi = request.method === "GET" && pathname.startsWith("/api/weekly-competitions/") && pathname.endsWith("/results");
  const isWeeklyAdminApi = pathname.startsWith("/api/admin/weekly-");

  if ((isWeeklyPage || (isWeeklyApi && !isWeeklyResultReadApi)) && !(await hasWeeklyAdminSession(request))) {
    if (isWeeklyApi) {
      return NextResponse.json({ message: "请先登录周赛管理员账号" }, { status: 401 });
    }

    const accessUrl = request.nextUrl.clone();
    accessUrl.pathname = "/weekly/access";
    accessUrl.search = "";
    accessUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(accessUrl);
  }

  if (isWeeklyAdminApi && !(await hasWeeklyAdminSession(request))) {
    return NextResponse.json({ message: "请先登录周赛管理员账号" }, { status: 401 });
  }

  if (host === "www.lncubing.com" && pathname.startsWith("/admin")) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.hostname = "lncubing.com";
    return NextResponse.redirect(canonicalUrl);
  }

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !(await hasAdminSession(request))) {
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
    "/api/weekly-competitions/:path*"
  ]
};
