import { NextRequest, NextResponse } from "next/server";
import { canEditJudges } from "@/lib/judge-auth";
import { createSessionToken, verifySessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const judgeCookieName = "liaoning_judge_session";

function isSecureRequest(request: NextRequest) {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as { password?: string } | null;
  if (!canEditJudges(payload?.password)) {
    return NextResponse.json({ message: "无法编辑。" }, { status: 401 });
  }
  const password = typeof payload?.password === "string" ? payload.password : "";

  const response = NextResponse.json({ ok: true });
  response.cookies.set(judgeCookieName, await createSessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    maxAge: 60 * 60 * 24 * 7,
    path: "/"
  });
  return response;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(judgeCookieName)?.value;
  return NextResponse.json({ authenticated: Boolean(token && (await verifySessionToken(token))) });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(judgeCookieName, "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" });
  return response;
}
