#!/usr/bin/env node
// One-time script to create application tables (account books, weekly meets).
// Usage: node scripts/init-app-db.mjs
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Account book tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS account_entries (
        id TEXT PRIMARY KEY,
        competition_name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        category TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        date TEXT NOT NULL DEFAULT '',
        payer_or_payee TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by TEXT NOT NULL DEFAULT ''
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS account_history (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        created_by TEXT NOT NULL DEFAULT '',
        entry_count INTEGER NOT NULL DEFAULT 0,
        total_income NUMERIC(12, 2) NOT NULL DEFAULT 0,
        total_expense NUMERIC(12, 2) NOT NULL DEFAULT 0
      )
    `);

    // Weekly meet tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_meets (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        week_number INTEGER NOT NULL,
        year INTEGER NOT NULL,
        year_week INTEGER NOT NULL,
        published_at TEXT,
        event TEXT NOT NULL DEFAULT '三阶',
        date_label TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        pb_note TEXT NOT NULL DEFAULT '',
        three_age_intro TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        starts_at TIMESTAMPTZ,
        ends_at TIMESTAMPTZ,
        is_public BOOLEAN NOT NULL DEFAULT FALSE,
        data_version SMALLINT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query("ALTER TABLE weekly_meets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'");
    await client.query("ALTER TABLE weekly_meets ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ");
    await client.query("ALTER TABLE weekly_meets ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ");
    await client.query("ALTER TABLE weekly_meets ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE");
    await client.query("ALTER TABLE weekly_meets ADD COLUMN IF NOT EXISTS data_version SMALLINT NOT NULL DEFAULT 1");
    await client.query("ALTER TABLE weekly_meets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()");

    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_meet_intros (
        meet_id TEXT NOT NULL REFERENCES weekly_meets(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        text TEXT NOT NULL,
        PRIMARY KEY (meet_id, seq)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_events (
        id TEXT NOT NULL,
        meet_id TEXT NOT NULL REFERENCES weekly_meets(id) ON DELETE CASCADE,
        kind TEXT NOT NULL DEFAULT 'other',
        title TEXT NOT NULL,
        event_name TEXT NOT NULL,
        group_name TEXT,
        is_all_around BOOLEAN NOT NULL DEFAULT FALSE,
        event_code TEXT,
        format TEXT NOT NULL DEFAULT 'avg5',
        attempt_count INTEGER NOT NULL DEFAULT 5,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        seq INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (id, meet_id)
      )
    `);
    await client.query("ALTER TABLE weekly_events ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'avg5'");
    await client.query("ALTER TABLE weekly_events ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 5");
    await client.query("ALTER TABLE weekly_events ADD COLUMN IF NOT EXISTS event_code TEXT");
    await client.query("ALTER TABLE weekly_events ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE");
    await client.query("ALTER TABLE weekly_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()");
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS weekly_events_meet_event_code_idx
      ON weekly_events (meet_id, event_code)
      WHERE event_code IS NOT NULL AND event_code <> ''
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_results (
        id SERIAL PRIMARY KEY,
        event_id TEXT NOT NULL,
        meet_id TEXT NOT NULL,
        rank INTEGER NOT NULL,
        player_name TEXT NOT NULL,
        player_slug TEXT NOT NULL DEFAULT '',
        gender TEXT NOT NULL DEFAULT '男',
        age_group TEXT,
        level TEXT NOT NULL DEFAULT '',
        grade TEXT NOT NULL DEFAULT '',
        average NUMERIC(10, 3) NOT NULL,
        personal_best NUMERIC(10, 3) NOT NULL,
        pb_refreshed BOOLEAN NOT NULL DEFAULT FALSE,
        pb_average_refreshed BOOLEAN NOT NULL DEFAULT FALSE,
        source_rank INTEGER,
        source_age_group TEXT,
        source_personal_best NUMERIC(10, 3),
        player_id TEXT,
        source TEXT NOT NULL DEFAULT 'legacy',
        import_batch_id TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        FOREIGN KEY (event_id, meet_id) REFERENCES weekly_events(id, meet_id) ON DELETE CASCADE
      )
    `);
    await client.query("ALTER TABLE weekly_results ADD COLUMN IF NOT EXISTS player_id TEXT");
    await client.query("ALTER TABLE weekly_results ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'legacy'");
    await client.query("ALTER TABLE weekly_results ALTER COLUMN source SET DEFAULT 'legacy'");
    await client.query("ALTER TABLE weekly_results ADD COLUMN IF NOT EXISTS import_batch_id TEXT");
    await client.query("ALTER TABLE weekly_results ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()");
    await client.query("ALTER TABLE weekly_results ADD COLUMN IF NOT EXISTS source_rank INTEGER");
    await client.query("ALTER TABLE weekly_results ADD COLUMN IF NOT EXISTS source_age_group TEXT");
    await client.query("ALTER TABLE weekly_results ADD COLUMN IF NOT EXISTS source_personal_best NUMERIC(10, 3)");
    await client.query("CREATE INDEX IF NOT EXISTS weekly_results_player_id_idx ON weekly_results (player_id)");
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS weekly_results_meet_event_player_idx
      ON weekly_results (meet_id, event_id, player_id)
      WHERE player_id IS NOT NULL
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_attempts (
        result_id INTEGER NOT NULL REFERENCES weekly_results(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        value NUMERIC(10, 3),
        value_centiseconds INTEGER,
        status TEXT NOT NULL DEFAULT 'legacy',
        CONSTRAINT weekly_attempts_v2_value_check CHECK (
          status = 'legacy'
          OR (status = 'ok' AND value_centiseconds IS NOT NULL AND value_centiseconds >= 0)
          OR (status IN ('dnf', 'dns') AND value_centiseconds IS NULL)
        ),
        PRIMARY KEY (result_id, seq)
      )
    `);
    await client.query("ALTER TABLE weekly_attempts ADD COLUMN IF NOT EXISTS value_centiseconds INTEGER");
    await client.query("ALTER TABLE weekly_attempts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'legacy'");
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'weekly_attempts_v2_value_check'
        ) THEN
          ALTER TABLE weekly_attempts
            ADD CONSTRAINT weekly_attempts_v2_value_check
            CHECK (
              status = 'legacy'
              OR (status = 'ok' AND value_centiseconds IS NOT NULL AND value_centiseconds >= 0)
              OR (status IN ('dnf', 'dns') AND value_centiseconds IS NULL)
            ) NOT VALID;
        END IF;
      END $$
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_result_revisions (
        id BIGSERIAL PRIMARY KEY,
        result_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        previous_attempts JSONB NOT NULL DEFAULT '[]'::jsonb,
        next_attempts JSONB NOT NULL DEFAULT '[]'::jsonb,
        previous_average NUMERIC(10, 3),
        next_average NUMERIC(10, 3),
        actor TEXT NOT NULL DEFAULT 'admin',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query("CREATE INDEX IF NOT EXISTS weekly_result_revisions_result_id_idx ON weekly_result_revisions (result_id, created_at DESC)");
    await client.query("ALTER TABLE weekly_result_revisions ADD COLUMN IF NOT EXISTS meet_id TEXT");
    await client.query("ALTER TABLE weekly_result_revisions ADD COLUMN IF NOT EXISTS event_id TEXT");
    await client.query("ALTER TABLE weekly_result_revisions ADD COLUMN IF NOT EXISTS player_id TEXT");
    await client.query("ALTER TABLE weekly_result_revisions ADD COLUMN IF NOT EXISTS player_name TEXT NOT NULL DEFAULT ''");

    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_meet_event_configs (
        meet_id TEXT NOT NULL REFERENCES weekly_meets(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL,
        format TEXT NOT NULL DEFAULT 'avg5',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        seq INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (meet_id, event_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL DEFAULT '',
        wca_id TEXT NOT NULL DEFAULT '',
        gender TEXT NOT NULL DEFAULT '男',
        province TEXT NOT NULL DEFAULT '辽宁',
        city TEXT NOT NULL DEFAULT '',
        birth_date TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query("ALTER TABLE weekly_players ADD COLUMN IF NOT EXISTS birth_date TEXT NOT NULL DEFAULT ''");
    await client.query("CREATE INDEX IF NOT EXISTS weekly_players_name_idx ON weekly_players (name)");

    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_player_library (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        gender TEXT NOT NULL DEFAULT '',
        wca_id TEXT NOT NULL DEFAULT '',
        birth_date TEXT NOT NULL DEFAULT '',
        age_group_override TEXT NOT NULL DEFAULT '',
        age_group_is_fuzzy BOOLEAN NOT NULL DEFAULT FALSE,
        province TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        deactivated_at TIMESTAMPTZ,
        deactivation_reason TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS wca_id TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS wca_id_confirmed BOOLEAN NOT NULL DEFAULT FALSE");
    await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS age_group_override TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS age_group_is_fuzzy BOOLEAN NOT NULL DEFAULT FALSE");
    await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS personal_bests JSONB NOT NULL DEFAULT '{}'::jsonb");
    await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS personal_bests_average JSONB NOT NULL DEFAULT '{}'::jsonb");
    await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS personal_bests_base JSONB NOT NULL DEFAULT '{}'::jsonb");
    await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS personal_bests_average_base JSONB NOT NULL DEFAULT '{}'::jsonb");
    await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'");
    await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ");
    await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS deactivation_reason TEXT NOT NULL DEFAULT ''");
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'weekly_player_library_status_check'
        ) THEN
          ALTER TABLE weekly_player_library
            ADD CONSTRAINT weekly_player_library_status_check
            CHECK (status IN ('active', 'inactive')) NOT VALID;
        END IF;
      END $$
    `);
    await client.query("CREATE INDEX IF NOT EXISTS weekly_player_library_name_idx ON weekly_player_library (name)");
    await client.query("CREATE INDEX IF NOT EXISTS weekly_player_library_wca_id_idx ON weekly_player_library (wca_id)");
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'weekly_results_player_library_fk'
        ) THEN
          ALTER TABLE weekly_results
            ADD CONSTRAINT weekly_results_player_library_fk
            FOREIGN KEY (player_id) REFERENCES weekly_player_library(id)
            ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
        END IF;
      END $$
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_player_wca_matches (
        id BIGSERIAL PRIMARY KEY,
        weekly_player_id TEXT NOT NULL REFERENCES weekly_player_library(id) ON DELETE CASCADE,
        wca_id TEXT NOT NULL,
        wca_name TEXT NOT NULL DEFAULT '',
        gender TEXT NOT NULL DEFAULT '',
        province TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        score INTEGER NOT NULL DEFAULT 0,
        method TEXT NOT NULL DEFAULT 'exact_name',
        evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
        status TEXT NOT NULL DEFAULT 'suggested',
        confirmed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (weekly_player_id, wca_id)
      )
    `);
    await client.query("CREATE INDEX IF NOT EXISTS weekly_player_wca_matches_player_idx ON weekly_player_wca_matches (weekly_player_id, status, score DESC)");
    await client.query("CREATE INDEX IF NOT EXISTS weekly_player_wca_matches_wca_idx ON weekly_player_wca_matches (wca_id, status)");
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS weekly_player_wca_matches_confirmed_wca_idx ON weekly_player_wca_matches (wca_id) WHERE status = 'confirmed'");

    await client.query(`
      CREATE TABLE IF NOT EXISTS big_stack_records (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query("CREATE INDEX IF NOT EXISTS big_stack_records_count_idx ON big_stack_records (count DESC)");

    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback_messages (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT '名单反馈',
        name TEXT NOT NULL DEFAULT '',
        wca_id TEXT NOT NULL DEFAULT '',
        contact TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL,
        page_url TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved')),
        ip_address TEXT NOT NULL DEFAULT '',
        user_agent TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        handled_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_import_batches (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('players', 'results')),
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
      )
    `);
    await client.query("CREATE INDEX IF NOT EXISTS weekly_import_batches_kind_created_idx ON weekly_import_batches (kind, created_at DESC)");
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS weekly_import_batches_committed_file_idx ON weekly_import_batches (kind, file_sha256) WHERE status = 'committed'");
    await client.query("CREATE INDEX IF NOT EXISTS weekly_results_import_batch_id_idx ON weekly_results (import_batch_id) WHERE import_batch_id IS NOT NULL");
    await client.query(`
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
      END $$
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS page_views (
        id BIGSERIAL PRIMARY KEY,
        path TEXT NOT NULL,
        referrer TEXT NOT NULL DEFAULT '',
        user_agent TEXT NOT NULL DEFAULT '',
        device_type TEXT NOT NULL DEFAULT 'unknown',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query("CREATE INDEX IF NOT EXISTS page_views_created_at_idx ON page_views (created_at)");
    await client.query("CREATE INDEX IF NOT EXISTS page_views_path_idx ON page_views (path)");

    // Admin-curated JSON datasets (judges, coaches, local profiles).
    // PostgreSQL is the source of truth; the data/*.json mirror is a fallback.
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_documents (
        key TEXT PRIMARY KEY,
        content JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS wca_import_metadata (
        id TEXT PRIMARY KEY,
        export_date TEXT NOT NULL,
        schema_version TEXT NOT NULL DEFAULT '',
        imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS wca_local_rank_snapshots (
        export_date TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('single', 'average')),
        event_id TEXT NOT NULL,
        person_id TEXT NOT NULL,
        province TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        gender TEXT NOT NULL DEFAULT '',
        best INTEGER NOT NULL,
        country_rank INTEGER NOT NULL,
        world_rank INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (export_date, mode, event_id, person_id)
      )
    `);

    await client.query("COMMIT");
    console.log("✅ All tables created (or already exist).");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ init-app-db failed:", err.message);
  process.exit(1);
});
