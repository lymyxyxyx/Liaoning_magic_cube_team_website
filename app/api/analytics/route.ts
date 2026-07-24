import { NextRequest, NextResponse } from "next/server";
import { recordPageView } from "@/lib/analytics-store";
import { getPublicWriteRateLimit } from "@/lib/public-write-rate-limit";

export async function POST(request: NextRequest) {
  const rateLimit = getPublicWriteRateLimit(request, "analytics", 120, 60 * 1000);
  if (!rateLimit.allowed) {
    return new NextResponse(null, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } });
  }

  const payload = (await request.json().catch(() => null)) as { path?: string; referrer?: string } | null;
  if (!payload?.path) return new NextResponse(null, { status: 204 });

  try {
    await recordPageView({
      path: payload.path,
      referrer: payload.referrer || "",
      userAgent: request.headers.get("user-agent") || "",
      visitorIp: getClientIp(request)
    });
  } catch {
    // Analytics must never break the public site.
  }

  return new NextResponse(null, { status: 204 });
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor
    ?.split(",")
    .map((value) => value.trim())
    .find((value) => value && value.toLowerCase() !== "unknown");

  return (
    forwardedIp ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("true-client-ip") ||
    ""
  );
}
