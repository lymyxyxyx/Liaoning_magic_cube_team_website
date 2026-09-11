import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";

const COOKIE_NAME = "liaoning_commercial_admin_session";
const COMMERCIAL_ADMIN_PASSWORD = "87654312";

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
  const payload = await request.json().catch(() => null) as { password?: string } | null;
  if (!timingSafeStringEqual(String(payload?.password || ""), COMMERCIAL_ADMIN_PASSWORD)) {
    return NextResponse.json({ message: "密码不正确" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, await createSessionToken(COMMERCIAL_ADMIN_PASSWORD, "commercial-admin"), {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    maxAge: 60 * 60 * 24 * 7,
    path: "/"
  });
  return response;
}
