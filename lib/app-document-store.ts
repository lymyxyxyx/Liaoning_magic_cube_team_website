import { promises as fs } from "node:fs";
import path from "node:path";
import { getPostgresPool } from "@/lib/postgres";

// Shared persistence for small admin-curated JSON datasets (judges, coaches,
// local profiles). PostgreSQL is the source of truth so a single pg_dump
// captures everything; the on-disk JSON file is kept as a mirror that both
// feeds backup.sh and serves as a fallback when the database is unavailable
// (e.g. local dev without DATABASE_URL).

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  const pool = getPostgresPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_documents (
      key TEXT PRIMARY KEY,
      content JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  tableReady = true;
}

async function readFromFile<T>(filePath: string): Promise<T[] | null> {
  try {
    const payload = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

async function writeToFile<T>(filePath: string, data: T[]) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

async function writeToDb<T>(key: string, data: T[]) {
  await ensureTable();
  const pool = getPostgresPool();
  // content is JSONB: pass a JSON string so node-pg does not coerce the JS
  // array into a Postgres array literal.
  await pool.query(
    `INSERT INTO app_documents (key, content, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE
       SET content = EXCLUDED.content, updated_at = now()`,
    [key, JSON.stringify(data)]
  );
}

/**
 * Read a document set. Prefers PostgreSQL; if the database has no row yet but a
 * legacy JSON file exists, it seeds the database from the file and returns it.
 * Returns null when the data exists in neither place (caller supplies its own
 * default), and falls back to the file when the database is unreachable.
 */
export async function readAppDocument<T>(key: string, filePath: string): Promise<T[] | null> {
  if (process.env.DATABASE_URL) {
    try {
      await ensureTable();
      const pool = getPostgresPool();
      const { rows } = await pool.query<{ content: T[] }>(
        "SELECT content FROM app_documents WHERE key = $1",
        [key]
      );
      if (rows[0]) return rows[0].content;

      const fromFile = await readFromFile<T>(filePath);
      if (fromFile) {
        try {
          await writeToDb(key, fromFile);
        } catch {
          // Seeding is best-effort; still return the file contents.
        }
        return fromFile;
      }
      return null;
    } catch {
      // Database unreachable: fall back to the on-disk mirror.
    }
  }
  return readFromFile<T>(filePath);
}

/**
 * Persist a document set. Writes to PostgreSQL (source of truth) and mirrors to
 * the JSON file. When the database is unavailable the file write alone must
 * succeed; when the database write succeeds, a failed file mirror is tolerated.
 */
export async function writeAppDocument<T>(key: string, filePath: string, data: T[]): Promise<void> {
  let dbWritten = false;
  if (process.env.DATABASE_URL) {
    try {
      await writeToDb(key, data);
      dbWritten = true;
    } catch {
      dbWritten = false;
    }
  }

  try {
    await writeToFile(filePath, data);
  } catch (error) {
    if (!dbWritten) throw error;
  }
}
