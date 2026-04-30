import { NextRequest, NextResponse } from "next/server";

const adminCookieName = "liaoning_admin_session";
const adminCookieValue = "authenticated";
const adminNextCookieName = "liaoning_admin_next";

function hasAdminSession(request: NextRequest) {
  return request.cookies.get(adminCookieName)?.value === adminCookieValue;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

  if (host === "www.lncubing.com" && pathname.startsWith("/admin")) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.hostname = "lncubing.com";
    return NextResponse.redirect(canonicalUrl);
  }

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !hasAdminSession(request)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(adminNextCookieName, `${pathname}${request.nextUrl.search}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 5,
      path: "/"
    });
    return response;
  }

  if (pathname === "/api/account-books" && !hasAdminSession(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (pathname === "/api/local-profiles" && request.method !== "GET" && !hasAdminSession(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/local-profiles", "/api/account-books"]
};
