import { NextRequest, NextResponse } from "next/server";

const weeklyCookieName = "liaoning_weekly_session";
const weeklyCookieValue = "authenticated";
const weeklyNextCookieName = "liaoning_weekly_next";

function isSecureRequest(request: NextRequest) {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

export async function POST(request: NextRequest) {
  const weeklyPassword = process.env.WEEKLY_ADMIN_PASSWORD;
  if (!weeklyPassword) {
    return NextResponse.json({ message: "Server configuration error" }, { status: 500 });
  }

  const formData = await request.formData();
  const password = String(formData.get("password") || "");
  const nextPath = getSafeNextPath(request.cookies.get(weeklyNextCookieName)?.value || null);

  if (password !== weeklyPassword) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/weekly/admin/login/error";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), { status: 303 });
  response.cookies.set(weeklyCookieName, weeklyCookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    maxAge: 60 * 60 * 24 * 7,
    path: "/"
  });
  response.cookies.delete(weeklyNextCookieName);

  return response;
}

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/weekly/admin";
  if (value.startsWith("/weekly/admin/login")) return "/weekly/admin";
  return value;
}
