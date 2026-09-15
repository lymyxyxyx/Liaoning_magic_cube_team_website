-- Retire the standalone one-hour-count big-stack feature without deleting its
-- historical data. Weekly big-stack events are now the only active model.
DO $$
BEGIN
  IF to_regclass('public.big_stack_records') IS NOT NULL
     AND to_regclass('public.legacy_big_stack_records') IS NULL THEN
    ALTER TABLE big_stack_records RENAME TO legacy_big_stack_records;
  END IF;
END $$;

ALTER INDEX IF EXISTS big_stack_records_count_idx
  RENAME TO legacy_big_stack_records_count_idx;

COMMENT ON TABLE legacy_big_stack_records IS
  'Archived legacy one-hour solve-count records; not used by the weekly competition application.';

-- Weeks 35 and 36 predate the weekly big-stack event rollout. Add the two
-- currently visible timed events so those weeks use the same editable model as
-- every later week. They intentionally start empty.
WITH target_meets AS (
  SELECT id
    FROM weekly_meets
   WHERE data_version = 2
     AND year = 2026
     AND year_week IN (35, 36)
), event_definitions(event_code, event_name, seq) AS (
  VALUES
    ('bigstack333', '三阶', 6),
    ('bigstackmirror', '镜面', 7)
)
INSERT INTO weekly_events (
  id, meet_id, kind, title, event_name, group_name, is_all_around,
  event_code, format, attempt_count, enabled, seq, updated_at
)
SELECT
  target_meets.id || '-wca-' || event_definitions.event_code || '-best1',
  target_meets.id,
  'other',
  '大堆 · ' || event_definitions.event_name || ' · 单次取最快',
  event_definitions.event_name,
  '大堆',
  FALSE,
  event_definitions.event_code,
  'best1',
  1,
  TRUE,
  event_definitions.seq,
  now()
FROM target_meets
CROSS JOIN event_definitions
ON CONFLICT (meet_id, event_code)
  WHERE event_code IS NOT NULL AND event_code <> ''
DO UPDATE SET
  title = EXCLUDED.title,
  event_name = EXCLUDED.event_name,
  group_name = EXCLUDED.group_name,
  format = EXCLUDED.format,
  attempt_count = EXCLUDED.attempt_count,
  enabled = TRUE,
  seq = EXCLUDED.seq,
  updated_at = now();
