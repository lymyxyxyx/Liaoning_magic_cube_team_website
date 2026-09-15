-- Restore the standalone one-hour big-stack ranking while preserving the
-- original records. New rows must be attached to a weekly meet; older records
-- retain an explicit "period pending" source label until a teacher fills it in.
CREATE TABLE IF NOT EXISTS weekly_big_stack_records (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  event_code TEXT NOT NULL CHECK (event_code IN ('333', '222', 'pyram', 'maple', 'mirror')),
  solve_count INTEGER NOT NULL CHECK (solve_count >= 0),
  meet_id TEXT REFERENCES weekly_meets(id) ON DELETE SET NULL,
  source_label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weekly_big_stack_records_event_count_idx
  ON weekly_big_stack_records (event_code, solve_count DESC, name ASC);

CREATE INDEX IF NOT EXISTS weekly_big_stack_records_meet_idx
  ON weekly_big_stack_records (meet_id);

-- The retired table has no project or week information. It is intentionally
-- shown as 3x3 historical data (the original primary category) and clearly
-- marked as awaiting a period correction, never silently assigned to a week.
INSERT INTO weekly_big_stack_records (id, name, event_code, solve_count, meet_id, source_label, created_at, updated_at)
SELECT
  'restored-' || legacy.id,
  legacy.name,
  '333',
  legacy.count,
  NULL,
  '历史记录（期次待补）',
  legacy.updated_at,
  legacy.updated_at
FROM legacy_big_stack_records legacy
ON CONFLICT (id) DO NOTHING;
