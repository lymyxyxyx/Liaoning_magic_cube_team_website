#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const migrationsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const dryRun = process.argv.includes("--dry-run");
const statusOnly = process.argv.includes("--status");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function loadMigrations() {
  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql") && !filename.endsWith(".down.sql"))
    .sort();
  return Promise.all(filenames.map(async (filename) => {
    const sql = await readFile(path.join(migrationsDirectory, filename), "utf8");
    return {
      id: filename.slice(0, -4),
      filename,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex")
    };
  }));
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = await pool.connect();
  try {
    const migrations = await loadMigrations();
    const trackingTable = await client.query(
      "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists"
    );
    const trackingTableExists = Boolean(trackingTable.rows[0]?.exists);
    if (!trackingTableExists && !dryRun && !statusOnly) {
      await client.query(`
        CREATE TABLE schema_migrations (
          id TEXT PRIMARY KEY,
          checksum TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
    }

    const appliedResult = trackingTableExists
      ? await client.query("SELECT id, checksum, applied_at FROM schema_migrations ORDER BY id")
      : { rows: [] };
    const applied = new Map(appliedResult.rows.map((row) => [row.id, row]));

    for (const migration of migrations) {
      const previous = applied.get(migration.id);
      if (previous && previous.checksum !== migration.checksum) {
        throw new Error(`Applied migration checksum changed: ${migration.filename}`);
      }
      const state = previous ? `applied ${previous.applied_at.toISOString()}` : "pending";
      if (statusOnly) {
        console.log(`${migration.id}: ${state}`);
        continue;
      }
      if (previous) continue;

      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        if (dryRun) {
          await client.query("ROLLBACK");
          console.log(`${migration.id}: dry-run passed and rolled back`);
        } else {
          await client.query(
            "INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)",
            [migration.id, migration.checksum]
          );
          await client.query("COMMIT");
          console.log(`${migration.id}: applied`);
        }
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Database migration failed: ${error.message}`);
  process.exit(1);
});
