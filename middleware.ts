import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";

const adminCookieName = "liaoning_admin_session";
const adminNextCookieName = "liaoning_admin_next";
const weeklyCookieName = "liaoning_weekly_session";
const weeklyNextCookieName = "liaoning_weekly_next";

async function hasAdminSession(request: NextRequest) {
  const token = request.cookies.get(adminCookieName)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

async function hasWeeklySession(request: NextRequest) {
  const token = request.cookies.get(weeklyCookieName)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

function isSecureRequest(request: NextRequest) {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

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

  if (pathname.startsWith("/weekly/admin") && !pathname.startsWith("/weekly/admin/login") && !(await hasWeeklySession(request))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/weekly/admin/login";
    loginUrl.search = "";
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(weeklyNextCookieName, `${pathname}${request.nextUrl.search}`, {
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

  if (pathname.startsWith("/api/admin") && !(await hasAdminSession(request))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (pathname.startsWith("/api/weekly-admin") && !(await hasWeeklySession(request))) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/weekly/admin",
    "/weekly/admin/:path*",
    "/api/local-profiles",
    "/api/account-books",
    "/api/admin/:path*",
    "/api/weekly-admin/:path*"
  ]
};
