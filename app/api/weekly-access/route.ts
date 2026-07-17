import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { judgeEditPassword } from "@/lib/judge-auth";

const weeklyAdminCookieName = "liaoning_weekly_session";

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

function getSafeNextPath(value: FormDataEntryValue | null) {
  const path = String(value || "");
  if (!path.startsWith("/weekly") || path.startsWith("//") || path.startsWith("/weekly/access") || path.startsWith("/weekly/admin")) {
    return "/weekly/results";
  }
  return path;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") || "");
  const weeklyAdminPassword = process.env.WEEKLY_ADMIN_PASSWORD || judgeEditPassword;
  const nextPath = getSafeNextPath(formData.get("next"));

  if (!timingSafeStringEqual(password, weeklyAdminPassword)) {
    const errorUrl = request.nextUrl.clone();
    errorUrl.pathname = "/weekly/access";
    errorUrl.search = "";
    errorUrl.searchParams.set("next", nextPath);
    errorUrl.searchParams.set("error", "1");
    return NextResponse.redirect(errorUrl, { status: 303 });
  }

  const token = await createSessionToken(weeklyAdminPassword);
  const response = new NextResponse(null, { status: 303, headers: { Location: nextPath } });
  response.cookies.set(weeklyAdminCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    maxAge: 60 * 60 * 24 * 7,
    path: "/"
  });
  return response;
}
