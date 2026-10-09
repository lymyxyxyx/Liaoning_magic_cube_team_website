-- Treat the standalone big-stack ranking as a long-term personal-best board.
-- Weekly meet linkage remains optional source metadata; it is not the identity
-- or lifecycle boundary of a record.
ALTER TABLE weekly_big_stack_records
  ADD COLUMN IF NOT EXISTS player_id TEXT,
  ADD COLUMN IF NOT EXISTS wca_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS achieved_at DATE,
  ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS weekly_big_stack_records_event_player_idx
  ON weekly_big_stack_records (event_code, player_id)
  WHERE player_id IS NOT NULL AND player_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS weekly_big_stack_records_event_wca_idx
  ON weekly_big_stack_records (event_code, wca_id)
  WHERE wca_id <> '';

CREATE TABLE IF NOT EXISTS weekly_big_stack_import_batches (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL DEFAULT '',
  event_code TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('baseline', 'merge')),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor TEXT NOT NULL DEFAULT 'weekly-admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weekly_big_stack_record_revisions (
  id BIGSERIAL PRIMARY KEY,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  before_record JSONB,
  after_record JSONB,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  import_batch_id TEXT,
  actor TEXT NOT NULL DEFAULT 'weekly-admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weekly_big_stack_revisions_record_idx
  ON weekly_big_stack_record_revisions (record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS weekly_big_stack_revisions_created_idx
  ON weekly_big_stack_record_revisions (created_at DESC);

COMMENT ON TABLE weekly_big_stack_records IS
  'Long-term per-event personal-best records. meet_id is optional provenance, not a competition boundary.';
