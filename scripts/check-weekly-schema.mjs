#!/usr/bin/env node
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const expectedColumns = {
  weekly_meets: ["is_public", "data_version", "updated_at"],
  weekly_events: ["event_code", "enabled", "updated_at"],
  weekly_player_library: ["notes", "status", "deactivated_at", "deactivation_reason", "updated_at"],
  weekly_results: ["player_id", "player_name", "source", "import_batch_id", "age_group", "source_rank", "source_age_group", "source_personal_best", "pb_average_refreshed", "updated_at"],
  weekly_attempts: ["value", "value_centiseconds", "status"],
  weekly_import_batches: ["id", "kind", "filename", "file_sha256", "status", "preview_jsonb", "commit_manifest_jsonb"]
};

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = await pool.connect();
  try {
    const columns = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])
    `, [Object.keys(expectedColumns)]);
    const available = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
    const missing = Object.entries(expectedColumns).flatMap(([table, names]) =>
      names.filter((name) => !available.has(`${table}.${name}`)).map((name) => `${table}.${name}`)
    );
    if (missing.length > 0) throw new Error(`Missing weekly schema columns: ${missing.join(", ")}`);

    const indexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN ('weekly_events_meet_event_code_idx', 'weekly_results_meet_event_player_idx', 'weekly_import_batches_committed_file_idx')
    `);
    const indexNames = new Set(indexes.rows.map((row) => row.indexname));
    for (const name of ["weekly_events_meet_event_code_idx", "weekly_results_meet_event_player_idx", "weekly_import_batches_committed_file_idx"]) {
      if (!indexNames.has(name)) throw new Error(`Missing weekly schema index: ${name}`);
    }

    const constraints = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conname IN (
        'weekly_player_library_status_check',
        'weekly_attempts_v2_value_check',
        'weekly_results_player_library_fk',
        'weekly_results_import_batch_fk'
      )
    `);
    const constraintNames = new Set(constraints.rows.map((row) => row.conname));
    for (const name of ["weekly_player_library_status_check", "weekly_attempts_v2_value_check", "weekly_results_player_library_fk", "weekly_results_import_batch_fk"]) {
      if (!constraintNames.has(name)) throw new Error(`Missing weekly schema constraint: ${name}`);
    }

    const visibility = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE data_version = 1)::int AS legacy_count,
        COUNT(*) FILTER (WHERE data_version = 1 AND is_public)::int AS public_legacy_count
      FROM weekly_meets
    `);
    if (visibility.rows[0].public_legacy_count !== 0) {
      throw new Error("Legacy weekly meets must not be public");
    }

    console.log(JSON.stringify({
      ok: true,
      legacyMeets: visibility.rows[0].legacy_count,
      publicLegacyMeets: visibility.rows[0].public_legacy_count
    }));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Weekly schema check failed: ${error.message}`);
  process.exit(1);
});
