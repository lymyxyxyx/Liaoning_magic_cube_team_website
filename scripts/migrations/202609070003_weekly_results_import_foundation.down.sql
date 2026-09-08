DROP INDEX IF EXISTS weekly_results_import_batch_id_idx;
ALTER TABLE weekly_import_batches DROP CONSTRAINT IF EXISTS weekly_import_batches_kind_check;
ALTER TABLE weekly_import_batches
  ADD CONSTRAINT weekly_import_batches_kind_check CHECK (kind IN ('players')) NOT VALID;
