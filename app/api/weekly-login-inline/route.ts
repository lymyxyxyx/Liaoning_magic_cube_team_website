import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { clearWeeklyLoginFailures, getWeeklyLoginRateLimit, recordWeeklyLoginFailure } from "@/lib/weekly-login-rate-limit";

const weeklyCookieName = "liaoning_weekly_admin_session";

function isSecureRequest(request: NextRequest) {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

function timingSafeStringEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

export async function POST(request: NextRequest) {
  const weeklyPassword = process.env.WEEKLY_ADMIN_PASSWORD?.trim() || "";
  if (!weeklyPassword) return NextResponse.json({ message: "周赛管理员密码未配置" }, { status: 503 });

  const rateLimit = getWeeklyLoginRateLimit(request);
  if (!rateLimit.allowed) {
    return NextResponse.json({ message: "登录尝试过于频繁，请稍后再试" }, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }

  const payload = await request.json().catch(() => null) as { password?: string } | null;
  if (!timingSafeStringEqual(String(payload?.password || ""), weeklyPassword)) {
    const retryAfterSeconds = recordWeeklyLoginFailure(rateLimit.key);
    return NextResponse.json(
      { message: retryAfterSeconds > 0 ? "登录尝试过于频繁，请稍后再试" : "管理员密码不正确" },
      { status: retryAfterSeconds > 0 ? 429 : 401, headers: retryAfterSeconds > 0 ? { "Retry-After": String(retryAfterSeconds) } : undefined }
    );
  }

  clearWeeklyLoginFailures(rateLimit.key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(weeklyCookieName, await createSessionToken(weeklyPassword, "weekly-admin"), {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    maxAge: 60 * 60 * 24 * 7,
    path: "/"
  });
  return response;
}
