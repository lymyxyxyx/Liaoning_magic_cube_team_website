ALTER TABLE weekly_attempts DROP CONSTRAINT IF EXISTS weekly_attempts_v2_value_check;
ALTER TABLE weekly_attempts DROP COLUMN IF EXISTS status;
ALTER TABLE weekly_attempts DROP COLUMN IF EXISTS value_centiseconds;

ALTER TABLE weekly_results DROP CONSTRAINT IF EXISTS weekly_results_player_library_fk;
ALTER TABLE weekly_results ALTER COLUMN source SET DEFAULT 'self';
ALTER TABLE weekly_results DROP COLUMN IF EXISTS import_batch_id;

ALTER TABLE weekly_player_library DROP CONSTRAINT IF EXISTS weekly_player_library_status_check;
ALTER TABLE weekly_player_library DROP COLUMN IF EXISTS deactivation_reason;
ALTER TABLE weekly_player_library DROP COLUMN IF EXISTS deactivated_at;
ALTER TABLE weekly_player_library DROP COLUMN IF EXISTS status;
ALTER TABLE weekly_player_library DROP COLUMN IF EXISTS notes;

DROP INDEX IF EXISTS weekly_events_meet_event_code_idx;
ALTER TABLE weekly_events DROP COLUMN IF EXISTS updated_at;
ALTER TABLE weekly_events DROP COLUMN IF EXISTS enabled;
ALTER TABLE weekly_events DROP COLUMN IF EXISTS event_code;

ALTER TABLE weekly_meets DROP COLUMN IF EXISTS updated_at;
ALTER TABLE weekly_meets DROP COLUMN IF EXISTS data_version;
ALTER TABLE weekly_meets DROP COLUMN IF EXISTS is_public;
