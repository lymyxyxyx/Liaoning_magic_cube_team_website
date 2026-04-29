import { NextRequest, NextResponse } from "next/server";

const adminPassword = "123456";
const adminCookieName = "liaoning_admin_session";
const adminCookieValue = "authenticated";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as { password?: string };

  if (payload.password !== adminPassword) {
    return NextResponse.json({ message: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminCookieName, adminCookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/"
  });

  return response;
}
