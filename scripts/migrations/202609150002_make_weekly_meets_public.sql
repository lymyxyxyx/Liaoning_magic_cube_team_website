-- Weekly results are permanently guest-readable. The flag stays only for
-- schema compatibility; the internal test meet remains private.
ALTER TABLE weekly_meets ALTER COLUMN is_public SET DEFAULT TRUE;

UPDATE weekly_meets
   SET is_public = TRUE,
       published_at = COALESCE(published_at, now()::text),
       updated_at = now()
 WHERE id <> 'weekly-test-entry';

UPDATE weekly_meets
   SET is_public = FALSE,
       published_at = NULL,
       updated_at = now()
 WHERE id = 'weekly-test-entry';
