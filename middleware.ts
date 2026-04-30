import { NextRequest, NextResponse } from "next/server";

const adminCookieName = "liaoning_admin_session";
const adminCookieValue = "authenticated";

function hasAdminSession(request: NextRequest) {
  return request.cookies.get(adminCookieName)?.value === adminCookieValue;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !hasAdminSession(request)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
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
