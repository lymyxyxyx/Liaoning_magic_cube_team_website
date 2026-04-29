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
const logFile = path.join(logDir, "wca_update.log");
const mode = process.argv.includes("--check") ? "check" : "update";

const tables = [
  { source: "persons", target: "wca_persons" },
  { source: "events", target: "wca_events" },
  { source: "countries", target: "wca_countries" },
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

async function writeLastExportDate(exportDate) {
  await fsp.writeFile(stateFile, `${exportDate}\n`, "utf8");
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
  await client.query('CREATE INDEX IF NOT EXISTS "wca_persons_country_id_idx" ON "wca_persons" ("country_id")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_events_id_idx" ON "wca_events" ("id")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_countries_id_idx" ON "wca_countries" ("id")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_ranks_single_event_rank_idx" ON "wca_ranks_single" ("event_id", "world_rank")');
  await client.query('CREATE INDEX IF NOT EXISTS "wca_ranks_average_event_rank_idx" ON "wca_ranks_average" ("event_id", "world_rank")');
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

async function importToPostgres() {
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
  } finally {
    await client.end();
  }
}

async function main() {
  await ensureBaseDirs();
  const payload = await fetchJson(exportApiUrl);
  const formatVersion = assertSupportedExport(payload);
  const lastExportDate = await readLastExportDate();

  await log(`WCA export_date=${payload.export_date}, format=${formatVersion || "unknown"}, last=${lastExportDate || "none"}`);

  if (payload.export_date === lastExportDate) {
    await log("WCA export is unchanged; exiting.");
    return;
  }

  if (mode === "check") {
    await log("WCA export has a newer version; run npm run wca:update to import it.");
    return;
  }

  const zipPath = path.join(rawDir, safeExportFilename(payload.export_date));
  await log(`Downloading TSV export to ${zipPath}`);
  await downloadFile(payload.tsv_url, zipPath);

  await log(`Extracting selected TSV files to ${tmpDir}`);
  await extractSelectedTsv(zipPath, tmpDir);

  try {
    await log("Importing selected TSV files into PostgreSQL");
    await importToPostgres();
    await writeLastExportDate(payload.export_date);
    await log(`WCA import completed; saved last_export_date=${payload.export_date}`);
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
