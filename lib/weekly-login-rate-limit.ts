import type { NextRequest } from "next/server";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const BLOCK_MS = 15 * 60 * 1000;

type LoginAttempt = {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number;
};

const attempts = new Map<string, LoginAttempt>();

export function getWeeklyLoginRateLimit(request: NextRequest) {
  const key = getClientKey(request);
  const now = Date.now();
  const current = attempts.get(key);

  if (!current) return { key, allowed: true, retryAfterSeconds: 0 };
  if (current.blockedUntil > now) {
    return { key, allowed: false, retryAfterSeconds: Math.ceil((current.blockedUntil - now) / 1000) };
  }
  if (now - current.windowStartedAt >= WINDOW_MS) {
    attempts.delete(key);
    return { key, allowed: true, retryAfterSeconds: 0 };
  }
  return { key, allowed: true, retryAfterSeconds: 0 };
}

export function recordWeeklyLoginFailure(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  const next = !current || now - current.windowStartedAt >= WINDOW_MS
    ? { failures: 1, windowStartedAt: now, blockedUntil: 0 }
    : { ...current, failures: current.failures + 1 };

  if (next.failures >= MAX_FAILURES) next.blockedUntil = now + BLOCK_MS;
  attempts.set(key, next);
  pruneAttempts(now);
  return Math.ceil(Math.max(0, next.blockedUntil - now) / 1000);
}

export function clearWeeklyLoginFailures(key: string) {
  attempts.delete(key);
}

function getClientKey(request: NextRequest) {
  // Only trust proxy-added IP headers when the deployment explicitly guarantees
  // that the public edge strips client-supplied values first.
  if (process.env.WEEKLY_TRUST_PROXY === "true") {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
    if (forwarded) return forwarded;
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
  }
  return "shared-client-bucket";
}

function pruneAttempts(now: number) {
  if (attempts.size < 1000) return;
  for (const [key, attempt] of attempts) {
    if (now - attempt.windowStartedAt >= WINDOW_MS && attempt.blockedUntil <= now) attempts.delete(key);
  }
}
