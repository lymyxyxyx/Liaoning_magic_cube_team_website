ALTER TABLE weekly_import_batches
  DROP CONSTRAINT IF EXISTS weekly_import_batches_kind_check;

ALTER TABLE weekly_import_batches
  ADD CONSTRAINT weekly_import_batches_kind_check
  CHECK (kind IN ('players', 'results')) NOT VALID;

CREATE INDEX IF NOT EXISTS weekly_results_import_batch_id_idx
  ON weekly_results (import_batch_id)
  WHERE import_batch_id IS NOT NULL;
