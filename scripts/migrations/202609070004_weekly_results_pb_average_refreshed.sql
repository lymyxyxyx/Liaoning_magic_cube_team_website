-- Forward-only repair for installations that already applied 001--003.
-- Match init-app-db.mjs exactly: BOOLEAN, NOT NULL, DEFAULT FALSE.
ALTER TABLE weekly_results
  ADD COLUMN IF NOT EXISTS pb_average_refreshed BOOLEAN NOT NULL DEFAULT FALSE;
