import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";

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
  const weeklyPassword = process.env.WEEKLY_ADMIN_PASSWORD;
  if (!weeklyPassword) {
    return NextResponse.json({ message: "Server configuration error" }, { status: 500 });
  }

  const formData = await request.formData();
  const password = String(formData.get("password") || "");
  const nextPath = getSafeNextPath(request.cookies.get(weeklyNextCookieName)?.value || null);

  if (!timingSafeStringEqual(password, weeklyPassword)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/weekly/admin/login/error";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

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
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/weekly/admin";
  if (value.startsWith("/weekly/admin/login")) return "/weekly/admin";
  return value;
}

function createRelativeRedirect(path: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: path
    }
  });
}
