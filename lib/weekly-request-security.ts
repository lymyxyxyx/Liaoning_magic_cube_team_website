import { NextRequest } from "next/server";

export function isWeeklySameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const requestOrigin = new URL(origin);
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
    const expectedOrigin = forwardedHost
      ? `${forwardedProto || request.nextUrl.protocol.replace(":", "")}://${forwardedHost}`
      : request.nextUrl.origin;
    return requestOrigin.origin === expectedOrigin;
  } catch {
    return false;
  }
}
