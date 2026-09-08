-- Weekly v2 foundation. Existing weekly data remains intact and is classified
-- as non-public data_version 1 through additive column defaults.

ALTER TABLE weekly_meets
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_version SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE weekly_events
  ADD COLUMN IF NOT EXISTS event_code TEXT,
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS weekly_events_meet_event_code_idx
  ON weekly_events (meet_id, event_code)
  WHERE event_code IS NOT NULL AND event_code <> '';

ALTER TABLE weekly_player_library
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'weekly_player_library_status_check'
  ) THEN
    ALTER TABLE weekly_player_library
      ADD CONSTRAINT weekly_player_library_status_check
      CHECK (status IN ('active', 'inactive')) NOT VALID;
  END IF;
END $$;

ALTER TABLE weekly_results
  ADD COLUMN IF NOT EXISTS import_batch_id TEXT;

ALTER TABLE weekly_results
  ALTER COLUMN source SET DEFAULT 'legacy';

CREATE UNIQUE INDEX IF NOT EXISTS weekly_results_meet_event_player_idx
  ON weekly_results (meet_id, event_id, player_id)
  WHERE player_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'weekly_results_player_library_fk'
  ) THEN
    ALTER TABLE weekly_results
      ADD CONSTRAINT weekly_results_player_library_fk
      FOREIGN KEY (player_id) REFERENCES weekly_player_library(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

ALTER TABLE weekly_attempts
  ADD COLUMN IF NOT EXISTS value_centiseconds INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'legacy';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'weekly_attempts_v2_value_check'
  ) THEN
    ALTER TABLE weekly_attempts
      ADD CONSTRAINT weekly_attempts_v2_value_check
      CHECK (
        status = 'legacy'
        OR (status = 'ok' AND value_centiseconds IS NOT NULL AND value_centiseconds >= 0)
        OR (status IN ('dnf', 'dns') AND value_centiseconds IS NULL)
      ) NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN weekly_results.age_group IS
  'Meet-specific age group snapshot: derived from birth date when available, otherwise supplied by an administrator.';
COMMENT ON COLUMN weekly_results.player_name IS
  'Player name snapshot at the time of the meet; player_id is the identity key for new results.';
COMMENT ON COLUMN weekly_attempts.value IS
  'Legacy seconds value retained for backward-compatible reads.';
COMMENT ON COLUMN weekly_attempts.value_centiseconds IS
  'Canonical integer result value for weekly v2 attempts when status is ok.';

CREATE TABLE IF NOT EXISTS big_stack_records (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS big_stack_records_count_idx
  ON big_stack_records (count DESC);
