import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";

const weeklyAccessCookieName = "liaoning_weekly_access";

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
  const inviteCode = String(formData.get("inviteCode") || "");
  const expectedInviteCode = process.env.WEEKLY_INVITE_CODE || "";
  const nextPath = getSafeNextPath(formData.get("next"));

  if (!timingSafeStringEqual(inviteCode, expectedInviteCode)) {
    const errorUrl = request.nextUrl.clone();
    errorUrl.pathname = "/weekly/access";
    errorUrl.search = "";
    errorUrl.searchParams.set("next", nextPath);
    errorUrl.searchParams.set("error", "1");
    return NextResponse.redirect(errorUrl, { status: 303 });
  }

  const token = await createSessionToken(expectedInviteCode);
  const response = new NextResponse(null, { status: 303, headers: { Location: nextPath } });
  response.cookies.set(weeklyAccessCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    maxAge: 60 * 60 * 24 * 7,
    path: "/"
  });
  return response;
}
