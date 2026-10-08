CREATE TABLE IF NOT EXISTS weekly_login_rate_limits (
  key_hash TEXT PRIMARY KEY,
  failures INTEGER NOT NULL CHECK (failures > 0),
  window_started_at TIMESTAMPTZ NOT NULL,
  blocked_until TIMESTAMPTZ NOT NULL DEFAULT 'epoch'
);
CREATE INDEX IF NOT EXISTS weekly_login_rate_limits_window_idx ON weekly_login_rate_limits(window_started_at);
