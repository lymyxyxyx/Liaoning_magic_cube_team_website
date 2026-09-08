CREATE TABLE IF NOT EXISTS weekly_import_batches (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('players')),
  filename TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('parsed', 'needs_review', 'ready', 'committed', 'failed', 'rolled_back')),
  raw_row_count INTEGER NOT NULL DEFAULT 0,
  valid_row_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  preview_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  commit_manifest_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_actor TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  committed_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS weekly_import_batches_kind_created_idx
  ON weekly_import_batches (kind, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS weekly_import_batches_committed_file_idx
  ON weekly_import_batches (kind, file_sha256)
  WHERE status = 'committed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'weekly_results_import_batch_fk'
  ) THEN
    ALTER TABLE weekly_results
      ADD CONSTRAINT weekly_results_import_batch_fk
      FOREIGN KEY (import_batch_id) REFERENCES weekly_import_batches(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;
