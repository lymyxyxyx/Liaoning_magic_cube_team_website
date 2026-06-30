import { NextRequest, NextResponse } from "next/server";
import { recordPageView } from "@/lib/analytics-store";

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as { path?: string; referrer?: string } | null;
  if (!payload?.path) return new NextResponse(null, { status: 204 });

  try {
    await recordPageView({
      path: payload.path,
      referrer: payload.referrer || "",
      userAgent: request.headers.get("user-agent") || ""
    });
  } catch {
    // Analytics must never break the public site.
  }

  return new NextResponse(null, { status: 204 });
}
