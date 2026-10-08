import type { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { getPostgresPool } from "@/lib/postgres";

export async function getWeeklyLoginRateLimit(request: NextRequest) {
  const key = getWeeklyLoginClientKey(request);
  const { rows } = await getPostgresPool().query<{ retry_after: number }>(
    `SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM (blocked_until - now()))))::int AS retry_after
       FROM weekly_login_rate_limits WHERE key_hash = $1`, [key]
  );
  const retryAfterSeconds = rows[0]?.retry_after || 0;
  return { key, allowed: retryAfterSeconds === 0, retryAfterSeconds };
}

export async function recordWeeklyLoginFailure(key: string) {
  const { rows } = await getPostgresPool().query<{ retry_after: number }>(
    `INSERT INTO weekly_login_rate_limits (key_hash, failures, window_started_at, blocked_until)
     VALUES ($1, 1, now(), 'epoch')
     ON CONFLICT (key_hash) DO UPDATE SET
       failures = CASE
         WHEN weekly_login_rate_limits.blocked_until > now() THEN weekly_login_rate_limits.failures
         WHEN weekly_login_rate_limits.blocked_until > 'epoch' OR weekly_login_rate_limits.window_started_at <= now() - interval '15 minutes' THEN 1
         ELSE weekly_login_rate_limits.failures + 1 END,
       window_started_at = CASE
         WHEN weekly_login_rate_limits.blocked_until > now() THEN weekly_login_rate_limits.window_started_at
         WHEN weekly_login_rate_limits.blocked_until > 'epoch' OR weekly_login_rate_limits.window_started_at <= now() - interval '15 minutes' THEN now()
         ELSE weekly_login_rate_limits.window_started_at END,
       blocked_until = CASE
         WHEN weekly_login_rate_limits.blocked_until > now() THEN weekly_login_rate_limits.blocked_until
         WHEN weekly_login_rate_limits.blocked_until > 'epoch' OR weekly_login_rate_limits.window_started_at <= now() - interval '15 minutes' THEN 'epoch'::timestamptz
         WHEN weekly_login_rate_limits.failures + 1 >= 5 THEN now() + interval '1 minute'
         ELSE 'epoch'::timestamptz END
     RETURNING GREATEST(0, CEIL(EXTRACT(EPOCH FROM (blocked_until - now()))))::int AS retry_after`, [key]
  );
  // Bound retention; identifiers are hashed and expired counters have no security value.
  await getPostgresPool().query("DELETE FROM weekly_login_rate_limits WHERE window_started_at < now() - interval '1 day' AND blocked_until <= now()");
  return rows[0].retry_after;
}

export async function clearWeeklyLoginFailures(key: string) {
  await getPostgresPool().query("DELETE FROM weekly_login_rate_limits WHERE key_hash = $1", [key]);
}

export function getWeeklyLoginClientKey(request: NextRequest) {
  // Nginx overwrites X-Real-IP with $remote_addr. Its appended X-Forwarded-For
  // chain can include attacker input, so never use that chain for login limits.
  const realIp = process.env.WEEKLY_TRUST_PROXY === "true" ? request.headers.get("x-real-ip")?.trim() : "";
  return createHash("sha256").update(realIp && isIP(realIp) ? realIp : "shared-client-bucket").digest("hex");
}
