import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";

const adminCookieName = "liaoning_admin_session";
const adminNextCookieName = "liaoning_admin_next";
const weeklyAccessCookieName = "liaoning_weekly_access";

async function hasAdminSession(request: NextRequest) {
  const token = request.cookies.get(adminCookieName)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

async function hasWeeklyAccessSession(request: NextRequest) {
  const token = request.cookies.get(weeklyAccessCookieName)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

function isSecureRequest(request: NextRequest) {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

  const isWeeklyPublicPage = pathname.startsWith("/weekly") && !pathname.startsWith("/weekly/access") && !pathname.startsWith("/weekly/admin");
  const isWeeklyPublicApi = pathname === "/api/weekly-competitions" || pathname.startsWith("/api/weekly-competitions/");

  if ((isWeeklyPublicPage || isWeeklyPublicApi) && !(await hasWeeklyAccessSession(request))) {
    if (isWeeklyPublicApi) {
      return NextResponse.json({ message: "请先输入周赛邀请码" }, { status: 401 });
    }

    const accessUrl = request.nextUrl.clone();
    accessUrl.pathname = "/weekly/access";
    accessUrl.search = "";
    accessUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(accessUrl);
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

  if (pathname.startsWith("/api/admin") && !(await hasAdminSession(request))) {
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
