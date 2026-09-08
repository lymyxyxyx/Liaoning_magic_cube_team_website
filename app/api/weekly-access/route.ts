import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { clearWeeklyLoginFailures, getWeeklyLoginRateLimit, recordWeeklyLoginFailure } from "@/lib/weekly-login-rate-limit";

const weeklyAccessCookieName = "liaoning_weekly_access_session";

function isSecureRequest(request: NextRequest) {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function getSafeNextPath(value: FormDataEntryValue | string | null | undefined) {
  const path = String(value || "");
  if (!path.startsWith("/weekly") || path.startsWith("//") || path.startsWith("/weekly/access") || path.startsWith("/weekly/admin")) {
    return "/weekly/results";
  }
  return path;
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? ((await request.json().catch(() => null)) as { password?: string; next?: string } | null)
    : null;
  const formData = payload ? null : await request.formData();
  const password = String(payload?.password || formData?.get("password") || "");
  const weeklyInviteCode = process.env.WEEKLY_INVITE_CODE?.trim() || "";
  const nextPath = getSafeNextPath(payload?.next || formData?.get("next"));

  if (!weeklyInviteCode) {
    return NextResponse.json({ message: "周赛邀请码未配置" }, { status: 503 });
  }

  const rateLimit = getWeeklyLoginRateLimit(request);
  if (!rateLimit.allowed) {
    return NextResponse.json({ message: "登录尝试过于频繁，请稍后再试" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }

  if (!timingSafeStringEqual(password, weeklyInviteCode)) {
    const retryAfterSeconds = recordWeeklyLoginFailure(rateLimit.key);
    if (payload && retryAfterSeconds > 0) {
      return NextResponse.json({ message: "登录尝试过于频繁，请稍后再试" }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
    }
    if (payload) return NextResponse.json({ message: "周赛邀请码不正确" }, { status: 401 });
    const errorUrl = request.nextUrl.clone();
    errorUrl.pathname = "/weekly/access";
    errorUrl.search = "";
    errorUrl.searchParams.set("next", nextPath);
    errorUrl.searchParams.set("error", "1");
    return NextResponse.redirect(errorUrl, { status: 303 });
  }

  clearWeeklyLoginFailures(rateLimit.key);
  const token = await createSessionToken(weeklyInviteCode, "weekly-access");
  const response = new NextResponse(null, { status: 303, headers: { Location: nextPath } });
  response.cookies.set(weeklyAccessCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    maxAge: 60 * 60 * 24 * 7,
    path: "/"
  });
  if (payload) return NextResponse.json({ ok: true }, { status: 200, headers: response.headers });
  return response;
}
