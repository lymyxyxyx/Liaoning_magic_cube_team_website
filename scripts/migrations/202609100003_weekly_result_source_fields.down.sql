ALTER TABLE weekly_results
  DROP COLUMN IF EXISTS source_personal_best,
  DROP COLUMN IF EXISTS source_age_group,
  DROP COLUMN IF EXISTS source_rank;
