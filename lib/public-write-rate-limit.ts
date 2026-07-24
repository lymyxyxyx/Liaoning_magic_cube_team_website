import type { NextRequest } from "next/server";

type RateLimitEntry = { count: number; resetAt: number };

const entries = new Map<string, RateLimitEntry>();

export function getPublicWriteRateLimit(request: NextRequest, scope: string, limit: number, windowMs: number) {
  const now = Date.now();
  const key = `${scope}:${getClientKey(request)}`;
  const current = entries.get(key);

  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs });
    pruneEntries(now);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  current.count += 1;
  if (current.count <= limit) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
}

function getClientKey(request: NextRequest) {
  // Nginx sets X-Real-IP from the TCP peer. Only trust it when the app is not
  // directly exposed to the public internet.
  if (process.env.PUBLIC_WRITE_TRUST_PROXY === "true") {
    const ip = request.headers.get("x-real-ip")?.trim();
    if (ip) return ip;
  }
  return "shared-client-bucket";
}

function pruneEntries(now: number) {
  if (entries.size < 2000) return;
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) entries.delete(key);
  }
}
