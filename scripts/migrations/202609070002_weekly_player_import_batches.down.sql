ALTER TABLE weekly_results DROP CONSTRAINT IF EXISTS weekly_results_import_batch_fk;
DROP INDEX IF EXISTS weekly_import_batches_committed_file_idx;
DROP INDEX IF EXISTS weekly_import_batches_kind_created_idx;
DROP TABLE IF EXISTS weekly_import_batches;
