ALTER TABLE weekly_results
  ADD COLUMN IF NOT EXISTS source_rank INTEGER,
  ADD COLUMN IF NOT EXISTS source_age_group TEXT,
  ADD COLUMN IF NOT EXISTS source_personal_best NUMERIC(10, 3);

COMMENT ON COLUMN weekly_results.source_rank IS
  'Original overall rank from the source result sheet; NULL for native entries.';
COMMENT ON COLUMN weekly_results.source_age_group IS
  'Age-group snapshot printed in the source result sheet.';
COMMENT ON COLUMN weekly_results.source_personal_best IS
  'Personal PB printed in the source sheet, distinct from this meet result best.';

WITH source_data(event_code, player_name, source_rank, source_age_group, level, grade, source_personal_best) AS (
  VALUES
    ('333', '李恒恺', 1, 'U8', '特级大师', '★', 10.98),
    ('333', '李沐远', 2, 'U8', '大师级', '★★★', 12.99),
    ('333', '牟婉宁', 3, '成人', '', '★★★', 12.16),
    ('333', '陈祉行', 4, 'U8', '', '★★', 14.86),
    ('333', '张晋铭', 5, 'U10', '', '★★', 9.44),
    ('333', '吴晓可', 6, 'U8', '', '★', 15),
    ('333', '丁宥安', 7, 'U8', '', '★', 16.28),
    ('333', '李轩伊', 8, 'U10', '', '★', 14.82),
    ('333', '韩沐廷', 9, 'U8', '', '★', 12.77),
    ('333', '钟欣妍', 10, 'U8', '', '★', 14.87),
    ('333', '张千慧', 11, 'U8', '', '★', 13.14),
    ('333', '杨雯博', 12, 'U12', '专业级', '★★★★', 17.75),
    ('333', '万如初', 13, 'U10', '', '★★★★', 17.51),
    ('333', '王晗谕', 14, 'U12', '', '★★★★', 14.3),
    ('333', '李梓源', 15, 'U8', '', '★★★', 18.34),
    ('333', '李禹诺', 16, 'U8', '', '★★★', 14.98),
    ('333', '马启航', 17, 'U8', '', '★★★', 18.76),
    ('333', '王子睿', 18, 'U8', '', '★★', 16.99),
    ('333', '佟林骋', 19, 'U8', '', '★', 28.05),
    ('222', '黄梓墨', 1, 'U8', '特级大师', '★★★', 1.45),
    ('222', '牟婉宁', 2, '成人', '', '★', 3.43),
    ('222', '王子睿', 3, 'U8', '大师级', '★★★★', 3.81),
    ('222', '李轩伊', 4, 'U10', '', '★★★★', 1.77),
    ('222', '王晗谕', 5, 'U12', '', '★★', 5.01),
    ('222', '佟林骋', 6, 'U8', '专业级', '★★★', 7.6),
    ('pyram', '李恒恺', 1, 'U8', '特级大师', '★★', 3.7),
    ('pyram', '王子睿', 2, 'U8', '大师级', '★★★★', 3.72),
    ('pyram', '黄梓墨', 3, 'U8', '', '★★★★', 3.38),
    ('pyram', '牟婉宁', 4, '成人', '', '★★', 7.63),
    ('pyram', '李轩伊', 5, 'U10', '', '★★', 6.61),
    ('pyram', '佟林骋', 6, 'U8', '', '★', 8.68),
    ('pyram', '王晗谕', 7, 'U12', '高手级', '★★★★', 10.88),
    ('mirror', '李轩伊', 1, 'U10', '大师级', '★', 24.46),
    ('mirror', '佟林骋', 2, 'U8', '专业级', '★', 53.08),
    ('maple', '万如初', 1, 'U10', '特级大师', '★★★', 2.05),
    ('maple', '李轩伊', 2, 'U10', '', '★★', 2.17),
    ('maple', '黄梓墨', 3, 'U8', '', '★★', 2.22),
    ('maple', '王子睿', 4, 'U8', '', '★★', 1.08),
    ('maple', '王晗谕', 5, 'U12', '大师级', '★★★', 3.02),
    ('maple', '佟林骋', 6, 'U8', '', '★★', 8.93),
    ('individual', '李轩伊', 1, 'U10', '', '', 84.77),
    ('individual', '佟林骋', 2, 'U8', '', '', 122.77),
    ('individual', '王晗谕', 3, 'U12', '', '', 157.8)
)
UPDATE weekly_results AS result
SET source_rank = source_data.source_rank,
    source_age_group = source_data.source_age_group,
    level = source_data.level,
    grade = source_data.grade,
    source_personal_best = source_data.source_personal_best,
    updated_at = now()
FROM weekly_events AS event, source_data
WHERE result.meet_id = 'weekly-2026-08-17'
  AND event.id = result.event_id
  AND event.meet_id = result.meet_id
  AND event.event_code = source_data.event_code
  AND result.player_name = source_data.player_name;

DO $$
DECLARE
  source_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM weekly_results WHERE meet_id = 'weekly-2026-08-17'
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO source_count
  FROM weekly_results
  WHERE meet_id = 'weekly-2026-08-17'
    AND source_rank IS NOT NULL
    AND source_age_group IS NOT NULL
    AND source_personal_best IS NOT NULL;

  IF source_count <> 43 THEN
    RAISE EXCEPTION 'Week 34 source-field backfill expected 43 rows, found %', source_count;
  END IF;
END
$$;
