-- Weekly status is now computed by the application from its Beijing-time
-- window.  Normalize the stored snapshot so administration and direct SQL
-- inspection agree with the current state as well.
UPDATE weekly_meets
   SET starts_at = '2026-09-07T00:00:00+08:00'::timestamptz,
       ends_at = '2026-09-13T23:59:59+08:00'::timestamptz,
       date_label = '2026-09-07 至 2026-09-13',
       status = 'closed',
       updated_at = now()
 WHERE id = 'weekly-2026-09-07' AND data_version = 2;

UPDATE weekly_meets
   SET status = CASE
     WHEN starts_at IS NULL OR now() < starts_at THEN 'draft'
     WHEN ends_at IS NOT NULL AND now() > ends_at THEN 'closed'
     ELSE 'open'
   END,
       updated_at = now()
 WHERE data_version = 2;
