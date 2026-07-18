import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { clearWeeklyLoginFailures, getWeeklyLoginRateLimit, recordWeeklyLoginFailure } from "@/lib/weekly-login-rate-limit";

const weeklyCookieName = "liaoning_weekly_session";
const weeklyNextCookieName = "liaoning_weekly_next";

function isSecureRequest(request: NextRequest) {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(request: NextRequest) {
  const weeklyPassword = process.env.WEEKLY_ADMIN_PASSWORD?.trim() || "";

  if (!weeklyPassword) {
    return NextResponse.json({ message: "周赛管理员密码未配置" }, { status: 503 });
  }

  const rateLimit = getWeeklyLoginRateLimit(request);
  if (!rateLimit.allowed) {
    return NextResponse.json({ message: "登录尝试过于频繁，请稍后再试" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }

  const formData = await request.formData();
  const password = String(formData.get("password") || "");
  const nextPath = getSafeNextPath(request.cookies.get(weeklyNextCookieName)?.value || null);

  if (!timingSafeStringEqual(password, weeklyPassword)) {
    const retryAfterSeconds = recordWeeklyLoginFailure(rateLimit.key);
    if (retryAfterSeconds > 0) {
      return NextResponse.json({ message: "登录尝试过于频繁，请稍后再试" }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login/error";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  clearWeeklyLoginFailures(rateLimit.key);
  const token = await createSessionToken(weeklyPassword);

  const response = createRelativeRedirect(nextPath);
  response.cookies.set(weeklyCookieName, token, {
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
  if (!value) return "/admin/weekly";
  if (/[\\\x00-\x1f\x7f]/.test(value)) return "/admin/weekly";
  if (value === "/weekly/admin" || value.startsWith("/weekly/admin/")) return value.replace("/weekly/admin", "/admin/weekly");
  if (value.startsWith("/admin/weekly")) return value;
  return "/admin/weekly";
}

function createRelativeRedirect(path: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: path
    }
  });
}
