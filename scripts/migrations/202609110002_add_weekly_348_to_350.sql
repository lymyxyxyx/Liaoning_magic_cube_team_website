WITH meets (id, slug, title, week_number, year_week, date_label, status, starts_at, ends_at) AS (
  VALUES
    ('weekly-2026-08-24', '2026-week-35', '第348周周赛（2026年第35周）', 348, 35, '2026-08-24 至 2026-08-30', 'closed', '2026-08-24T00:00:00+08:00'::timestamptz, '2026-08-30T23:59:59+08:00'::timestamptz),
    ('weekly-2026-08-31', '2026-week-36', '第349周周赛（2026年第36周）', 349, 36, '2026-08-31 至 2026-09-06', 'closed', '2026-08-31T00:00:00+08:00'::timestamptz, '2026-09-06T23:59:59+08:00'::timestamptz),
    ('weekly-2026-09-07', '2026-week-37', '第350周周赛（2026年第37周）', 350, 37, '2026-09-07 至 2026-09-13', 'open', '2026-09-07T00:00:00+08:00'::timestamptz, '2026-09-13T23:59:59+08:00'::timestamptz)
)
INSERT INTO weekly_meets (id, slug, title, week_number, year, year_week, event, date_label, summary, pb_note, three_age_intro, status, starts_at, ends_at, is_public, data_version, updated_at)
SELECT id, slug, title, week_number, 2026, year_week, '三阶', date_label,
       '本周周赛成绩与排名。', '下表中个人 PB 部分标红的为本周刷新的成绩。',
       '三阶为周赛主要项目，项目配置沿用模板周赛。', status, starts_at, ends_at, FALSE, 2, now()
  FROM meets
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug, title = EXCLUDED.title, week_number = EXCLUDED.week_number,
  year = EXCLUDED.year, year_week = EXCLUDED.year_week, date_label = EXCLUDED.date_label,
  status = EXCLUDED.status, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
  data_version = 2, updated_at = now();

WITH event_configs (event_code, event_name, format, attempt_count, seq) AS (
  VALUES
    ('333', '三阶', 'avg5', 5, 0), ('222', '二阶', 'avg5', 5, 1),
    ('pyram', '金字塔', 'avg5', 5, 2), ('maple', '枫叶', 'avg5', 5, 3),
    ('mirror', '镜面', 'avg5', 5, 4), ('individual', '个人全能', 'best1', 1, 5)
), target_meets (id) AS (
  VALUES ('weekly-2026-08-24'), ('weekly-2026-08-31'), ('weekly-2026-09-07')
)
INSERT INTO weekly_events (id, meet_id, kind, title, event_name, group_name, is_all_around, event_code, format, attempt_count, enabled, seq, updated_at)
SELECT target.id || '-wca-' || config.event_code || '-' || config.format, target.id, 'other',
       config.event_name || ' · ' || CASE WHEN config.format = 'best1' THEN '单次取最快' ELSE '五次取平均' END,
       config.event_name, NULL, FALSE, config.event_code, config.format, config.attempt_count, TRUE, config.seq, now()
  FROM target_meets target CROSS JOIN event_configs config
ON CONFLICT (meet_id, event_code) WHERE event_code IS NOT NULL AND event_code <> ''
DO UPDATE SET title = EXCLUDED.title, event_name = EXCLUDED.event_name, format = EXCLUDED.format,
              attempt_count = EXCLUDED.attempt_count, enabled = TRUE, seq = EXCLUDED.seq, updated_at = now();
