-- Add the two currently available big-stack timed events to editable v2 weeks.
-- The remaining three event definitions stay disabled in the application until
-- their results are ready to be published.
WITH target_meets AS (
  SELECT id
    FROM weekly_meets
   WHERE data_version = 2
     AND status IN ('draft', 'open')
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
