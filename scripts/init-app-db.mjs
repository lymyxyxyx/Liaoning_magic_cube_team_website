#!/usr/bin/env node
// One-time script to create application tables (account books, weekly meets).
// Usage: node scripts/init-app-db.mjs
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

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
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

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
        seq INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (id, meet_id)
      )
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
        FOREIGN KEY (event_id, meet_id) REFERENCES weekly_events(id, meet_id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_attempts (
        result_id INTEGER NOT NULL REFERENCES weekly_results(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        value NUMERIC(10, 3),
        PRIMARY KEY (result_id, seq)
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
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS wca_id TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS age_group_override TEXT NOT NULL DEFAULT ''");
    await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS age_group_is_fuzzy BOOLEAN NOT NULL DEFAULT FALSE");
    await client.query("CREATE INDEX IF NOT EXISTS weekly_player_library_name_idx ON weekly_player_library (name)");
    await client.query("CREATE INDEX IF NOT EXISTS weekly_player_library_wca_id_idx ON weekly_player_library (wca_id)");

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
