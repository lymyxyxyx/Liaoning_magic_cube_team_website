#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Client } from "pg";
import { from as copyFrom } from "pg-copy-streams";
import yauzl from "yauzl";

const exportApiUrl = "https://www.worldcubeassociation.org/api/v0/export/public";
const defaultDataRoot = fs.existsSync("/app/data") ? "/app/data" : "/opt/ln-cubing/data";
const defaultLogDir = fs.existsSync("/app/logs") ? "/app/logs" : "/opt/ln-cubing/logs";
const dataRoot = process.env.WCA_DATA_ROOT || defaultDataRoot;
const rawDir = process.env.WCA_RAW_DIR || path.join(dataRoot, "wca_raw");
const tmpDir = process.env.WCA_TMP_DIR || path.join(dataRoot, "wca_tmp");
const stateDir = process.env.WCA_STATE_DIR || path.join(dataRoot, "wca_state");
const logDir = process.env.WCA_LOG_DIR || defaultLogDir;
const stateFile = path.join(stateDir, "last_export_date.txt");
const schemaStateFile = path.join(stateDir, "schema_version.txt");
const logFile = path.join(logDir, "wca_update.log");
const localProfilesFile = path.join(dataRoot, "local-profiles.json");
const mode = process.argv.includes("--check") ? "check" : "update";
const schemaVersion = "wca-sync-v1.5-results";

const tables = [
  { source: "persons", target: "wca_persons" },
  { source: "events", target: "wca_events" },
  { source: "countries", target: "wca_countries" },
  { source: "competitions", target: "wca_competitions" },
  { source: "results", target: "wca_results" },
  { source: "ranks_single", target: "wca_ranks_single" },
  { source: "ranks_average", target: "wca_ranks_average" }
];

async function ensureBaseDirs() {
  await Promise.all([rawDir, tmpDir, stateDir, logDir].map((dir) => fsp.mkdir(dir, { recursive: true })));
}

async function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  await fsp.appendFile(logFile, `${line}\n`, "utf8");
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "lncubing-wca-sync/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`WCA export API returned ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function readLastExportDate() {
  try {
    return (await fsp.readFile(stateFile, "utf8")).trim();
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

async function readSchemaVersion() {
  try {
    return (await fsp.readFile(schemaStateFile, "utf8")).trim();
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

async function writeLastExportDate(exportDate) {
  await fsp.writeFile(stateFile, `${exportDate}\n`, "utf8");
}

async function writeSchemaVersion() {
  await fsp.writeFile(schemaStateFile, `${schemaVersion}\n`, "utf8");
}

function normalizeFormatVersion(payload) {
  const rawVersion = payload.export_format_version || payload.export_version || "";
  return String(rawVersion).replace(/^v/i, "");
}

function assertSupportedExport(payload) {
  if (!payload.export_date || !payload.tsv_url) {
    throw new Error("WCA export API response is missing export_date or tsv_url");
  }

  const version = normalizeFormatVersion(payload);
  const major = version.split(".")[0];
  if (major && major !== "2") {
    throw new Error(`Unsupported WCA export format version ${version}; review importer before running.`);
  }

  return version;
}

function safeExportFilename(exportDate) {
  return `wca_export_${exportDate.replaceAll(":", "").replaceAll("-", "").replaceAll(".", "")}.zip`;
}

async function downloadFile(url, outputPath) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "lncubing-wca-sync/1.0"
    }
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download WCA TSV export: ${response.status} ${response.statusText}`);
  }

  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(outputPath));
}

function openZip(zipPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (error, zipFile) => {
      if (error) reject(error);
      else resolve(zipFile);
    });
  });
}

function openReadStream(zipFile, entry) {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, readStream) => {
      if (error) reject(error);
      else resolve(readStream);
    });
  });
}

function getSourceName(entryName) {
  const baseName = path.basename(entryName).replace(/\.tsv$/i, "");
  return baseName.replace(/^WCA_export_/i, "");
}

async function extractSelectedTsv(zipPath, outputDir) {
  await fsp.rm(outputDir, { recursive: true, force: true });
  await fsp.mkdir(outputDir, { recursive: true });

  const wanted = new Map(tables.map((table) => [table.source, path.join(outputDir, `${table.source}.tsv`)]));
  const extracted = new Set();
  const zipFile = await openZip(zipPath);

  await new Promise((resolve, reject) => {
    zipFile.readEntry();
    zipFile.on("entry", async (entry) => {
      try {
        const sourceName = getSourceName(entry.fileName);
        const outputPath = wanted.get(sourceName);
        if (!outputPath || /\/$/.test(entry.fileName)) {
          zipFile.readEntry();
          return;
        }

        const readStream = await openReadStream(zipFile, entry);
        await pipeline(readStream, fs.createWriteStream(outputPath));
        extracted.add(sourceName);
        zipFile.readEntry();
      } catch (error) {
        reject(error);
      }
    });
    zipFile.on("end", resolve);
    zipFile.on("error", reject);
  });

  const missing = tables.filter((table) => !extracted.has(table.source)).map((table) => table.source);
  if (missing.length > 0) {
    throw new Error(`TSV export is missing required files: ${missing.join(", ")}`);
  }
}

async function readHeader(tsvPath) {
  const handle = await fsp.open(tsvPath, "r");
  try {
    const buffer = Buffer.alloc(1024 * 64);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const newlineIndex = buffer.subarray(0, bytesRead).indexOf("\n");
    if (newlineIndex === -1) throw new Error(`Could not read TSV header from ${tsvPath}`);
    return buffer
      .subarray(0, newlineIndex)
      .toString("utf8")
      .replace(/\r$/, "")
      .split("\t");
  } finally {
    await handle.close();
  }
}

function quoteIdent(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function columnDefinition(columns) {
  return columns.map((column) => `${quoteIdent(column)} text`).join(", ");
}

function copySql(tableName, columns) {
  const columnList = columns.map(quoteIdent).join(", ");
  return `COPY ${quoteIdent(tableName)} (${columnList}) FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', HEADER true, QUOTE E'\\b')`;
}

async function importTable(client, table) {
  const tsvPath = path.join(tmpDir, `${table.source}.tsv`);
  const columns = await readHeader(tsvPath);
  const tempTable = `${table.target}_new`;

  await client.query(`DROP TABLE IF EXISTS ${quoteIdent(tempTable)}`);
  await client.query(`CREATE TABLE ${quoteIdent(tempTable)} (${columnDefinition(columns)})`);
  await pipeline(fs.createReadStream(tsvPath), client.query(copyFrom(copySql(tempTable, columns))));
  const countResult = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${quoteIdent(tempTable)}`);
  await client.query(`ALTER TABLE ${quoteIdent(tempTable)} ADD COLUMN imported_at timestamptz NOT NULL DEFAULT now()`);

  return Number(countResult.rows[0].count);
}

async function addIndexes(client) {
  await client.query('CREATE INDEX IF NOT EXISTS "wca_persons_wca_id_idx" ON "wca_persons" ("wca_id")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_persons_wca_id_sub_id_idx" ON "wca_persons" ("wca_id", "sub_id")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_persons_country_id_idx" ON "wca_persons" ("country_id")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_events_id_idx" ON "wca_events" ("id")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_countries_id_idx" ON "wca_countries" ("id")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_competitions_id_idx" ON "wca_competitions" ("id")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_competitions_date_idx" ON "wca_competitions" ((year::int), (month::int), (day::int), "id")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_results_single_lookup_idx" ON "wca_results" ("event_id", "person_id", "best")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_results_average_lookup_idx" ON "wca_results" ("event_id", "person_id", "average")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_results_single_competition_lookup_idx" ON "wca_results" ("event_id", "person_id", "best", "competition_id")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_results_average_competition_lookup_idx" ON "wca_results" ("event_id", "person_id", "average", "competition_id")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_ranks_single_event_rank_idx" ON "wca_ranks_single" ("event_id", "world_rank")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_ranks_average_event_rank_idx" ON "wca_ranks_average" ("event_id", "world_rank")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_ranks_single_event_country_rank_idx" ON "wca_ranks_single" ("event_id", (country_rank::int), (world_rank::int), "person_id")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_ranks_average_event_country_rank_idx" ON "wca_ranks_average" ("event_id", (country_rank::int), (world_rank::int), "person_id")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_ranks_single_event_person_best_idx" ON "wca_ranks_single" ("event_id", "person_id", (best::int), (world_rank::int))');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_ranks_average_event_person_best_idx" ON "wca_ranks_average" ("event_id", "person_id", (best::int), (world_rank::int))');
}

async function swapTables(client) {
  await client.query("BEGIN");
  try {
    for (const table of tables) {
      await client.query(`DROP TABLE IF EXISTS ${quoteIdent(`${table.target}_old`)}`);
      await client.query(`ALTER TABLE IF EXISTS ${quoteIdent(table.target)} RENAME TO ${quoteIdent(`${table.target}_old`)}`);
      await client.query(`ALTER TABLE ${quoteIdent(`${table.target}_new`)} RENAME TO ${quoteIdent(table.target)}`);
    }
    for (const table of tables) {
      await client.query(`DROP TABLE IF EXISTS ${quoteIdent(`${table.target}_old`)}`);
    }
    await addIndexes(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function importToPostgres(exportDate) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for npm run wca:update");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();
  try {
    for (const table of tables) {
      const count = await importTable(client, table);
      await log(`Imported ${count} rows into ${table.target}_new`);
    }
    await swapTables(client);
    await writeImportMetadata(client, {
      exportDate,
      schemaVersion
    });
    await snapshotLocalRanks(client, exportDate);
  } finally {
    await client.end();
  }
}

async function refreshPostgresMetadata(exportDate) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for npm run wca:update");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();
  try {
    await writeImportMetadata(client, {
      exportDate,
      schemaVersion
    });
    await snapshotLocalRanks(client, exportDate);
  } finally {
    await client.end();
  }
}

async function writeImportMetadata(client, { exportDate, schemaVersion }) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS wca_import_metadata (
      id TEXT PRIMARY KEY,
      export_date TEXT NOT NULL,
      schema_version TEXT NOT NULL DEFAULT '',
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await client.query(
    `INSERT INTO wca_import_metadata (id, export_date, schema_version, imported_at)
     VALUES ('current', $1, $2, now())
     ON CONFLICT (id)
     DO UPDATE SET export_date = EXCLUDED.export_date,
                   schema_version = EXCLUDED.schema_version,
                   imported_at = EXCLUDED.imported_at`,
    [exportDate, schemaVersion]
  );
}

async function snapshotLocalRanks(client, exportDate) {
  const profiles = await readLocalProfilesForSnapshot();
  const visibleProfiles = profiles.filter((profile) => profile.visible !== false && profile.wcaId);
  const snapshotProfiles = visibleProfiles.map((profile) => ({
    wca_id: profile.wcaId,
    province: profile.province,
    city: profile.city
  }));
  const wcaIds = Array.from(new Set(visibleProfiles.map((profile) => profile.wcaId)));
  if (wcaIds.length === 0) {
    await log("Skipped local rank snapshot; no local WCA profiles found.");
    return;
  }

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
  await client.query("DELETE FROM wca_local_rank_snapshots WHERE export_date = $1", [exportDate]);

  for (const modeConfig of [
    { mode: "single", table: "wca_ranks_single" },
    { mode: "average", table: "wca_ranks_average" }
  ]) {
    const result = await client.query(
      `
        INSERT INTO wca_local_rank_snapshots
          (export_date, mode, event_id, person_id, province, city, gender, best, country_rank, world_rank)
        SELECT
          $1 AS export_date,
          $2 AS mode,
          rank.event_id,
          rank.person_id,
          profile.province,
          profile.city,
          person.gender,
          rank.best::int,
          rank.country_rank::int,
          rank.world_rank::int
        FROM jsonb_to_recordset($3::jsonb) AS profile(wca_id text, province text, city text)
        JOIN ${modeConfig.table} rank ON rank.person_id = profile.wca_id
        JOIN wca_persons person ON person.wca_id = rank.person_id AND person.sub_id = '1'
        WHERE rank.country_rank::int > 0
          AND rank.world_rank::int > 0
          AND rank.best::int > 0
      `,
      [exportDate, modeConfig.mode, JSON.stringify(snapshotProfiles)]
    );
    await log(`Snapshotted ${result.rowCount} ${modeConfig.mode} local rank rows for export_date=${exportDate}`);
  }
}

async function readLocalProfilesForSnapshot() {
  try {
    const raw = await fsp.readFile(localProfilesFile, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((profile) => ({
        wcaId: String(profile.wcaId || "").trim().toUpperCase(),
        province: String(profile.province || "辽宁").trim() || "辽宁",
        city: String(profile.city || "沈阳").trim() || "沈阳",
        visible: profile.visible !== false
      }))
      .filter((profile) => /^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(profile.wcaId));
  } catch {
    return [];
  }
}

async function main() {
  await ensureBaseDirs();
  const payload = await fetchJson(exportApiUrl);
  const formatVersion = assertSupportedExport(payload);
  const lastExportDate = await readLastExportDate();
  const lastSchemaVersion = await readSchemaVersion();

  await log(
    `WCA export_date=${payload.export_date}, format=${formatVersion || "unknown"}, last=${lastExportDate || "none"}, schema=${lastSchemaVersion || "none"}`
  );

  if (payload.export_date === lastExportDate && lastSchemaVersion === schemaVersion) {
    if (mode === "update") {
      await refreshPostgresMetadata(payload.export_date);
      await log("WCA export is unchanged; refreshed PostgreSQL metadata and local rank snapshot.");
      return;
    }
    await log("WCA export is unchanged; exiting.");
    return;
  }

  if (mode === "check") {
    await log("WCA export has a newer version; run npm run wca:update to import it.");
    return;
  }

  const zipPath = path.join(rawDir, safeExportFilename(payload.export_date));
  try {
    await fsp.access(zipPath, fs.constants.R_OK);
    await log(`Using existing TSV export at ${zipPath}`);
  } catch {
    await log(`Downloading TSV export to ${zipPath}`);
    await downloadFile(payload.tsv_url, zipPath);
  }

  await log(`Extracting selected TSV files to ${tmpDir}`);
  await extractSelectedTsv(zipPath, tmpDir);

  try {
    await log("Importing selected TSV files into PostgreSQL");
    await importToPostgres(payload.export_date);
    await writeLastExportDate(payload.export_date);
    await writeSchemaVersion();
    await log(`WCA import completed; saved last_export_date=${payload.export_date}, schema=${schemaVersion}`);
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
    await fsp.mkdir(tmpDir, { recursive: true });
    await log(`Cleaned temporary directory ${tmpDir}`);
  }
}

main().catch(async (error) => {
  try {
    await ensureBaseDirs();
    await log(`ERROR: ${error.stack || error.message}`);
  } catch {
    console.error(error);
  }
  process.exitCode = 1;
});
