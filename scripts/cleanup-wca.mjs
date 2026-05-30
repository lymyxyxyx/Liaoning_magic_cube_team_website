#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const defaultDataRoot = fs.existsSync("/app/data") ? "/app/data" : "/opt/ln-cubing/data";
const defaultLogDir = fs.existsSync("/app/logs") ? "/app/logs" : "/opt/ln-cubing/logs";
const dataRoot = process.env.WCA_DATA_ROOT || defaultDataRoot;
const logDir = process.env.WCA_LOG_DIR || defaultLogDir;
const rawDir = path.join(dataRoot, "wca_raw");
const tmpDir = path.join(dataRoot, "wca_tmp");
const MAX_LOG_LINES = 500;

async function cleanupRawZips() {
  if (!fs.existsSync(rawDir)) {
    console.log(`[cleanup] wca_raw dir not found at ${rawDir}, skipping`);
    return;
  }

  const files = (await fsp.readdir(rawDir))
    .filter((f) => f.endsWith(".zip"))
    .map(async (f) => {
      const stat = await fsp.stat(path.join(rawDir, f));
      return { name: f, mtimeMs: stat.mtimeMs, size: stat.size };
    });

  const zipFiles = await Promise.all(files);
  if (zipFiles.length <= 1) {
    console.log(`[cleanup] wca_raw: ${zipFiles.length} zip(s) found, nothing to remove`);
    return;
  }

  zipFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const toRemove = zipFiles.slice(1);
  let freedBytes = 0;

  for (const file of toRemove) {
    const filePath = path.join(rawDir, file.name);
    await fsp.unlink(filePath);
    freedBytes += file.size;
    console.log(`[cleanup] removed ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  }

  console.log(`[cleanup] wca_raw: removed ${toRemove.length} old zip(s), freed ${(freedBytes / 1024 / 1024).toFixed(1)} MB`);
}

async function cleanupTmpDir() {
  if (!fs.existsSync(tmpDir)) return;

  const entries = await fsp.readdir(tmpDir);
  if (entries.length === 0) {
    console.log("[cleanup] wca_tmp is already empty");
    return;
  }

  await fsp.rm(tmpDir, { recursive: true, force: true });
  await fsp.mkdir(tmpDir, { recursive: true });
  console.log(`[cleanup] cleaned wca_tmp (${entries.length} stale files)`);
}

async function rotateLogFile(logFilePath, maxLines) {
  if (!fs.existsSync(logFilePath)) return;

  const content = await fsp.readFile(logFilePath, "utf8");
  const lines = content.split("\n");
  if (lines.length <= maxLines + 50) {
    console.log(`[cleanup] ${path.basename(logFilePath)}: ${lines.length} lines, no rotation needed`);
    return;
  }

  const trimmed = lines.slice(-maxLines);
  await fsp.writeFile(logFilePath, trimmed.join("\n"), "utf8");
  console.log(`[cleanup] ${path.basename(logFilePath)}: rotated from ${lines.length} to ${maxLines} lines`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("[cleanup] DRY RUN mode, no files will be modified\n");
  }

  console.log(`[cleanup] data root: ${dataRoot}`);
  console.log(`[cleanup] log dir: ${logDir}\n`);

  if (!dryRun) {
    await cleanupRawZips();
    await cleanupTmpDir();
    await rotateLogFile(path.join(logDir, "wca_update.log"), MAX_LOG_LINES);
    await rotateLogFile(path.join(logDir, "wca_cron.log"), MAX_LOG_LINES);
  } else {
    // Dry run: just report what would be done
    if (fs.existsSync(rawDir)) {
      const files = (await fsp.readdir(rawDir)).filter((f) => f.endsWith(".zip"));
      console.log(`[cleanup] wca_raw: ${files.length} zip(s) found, would keep 1, remove ${Math.max(0, files.length - 1)}`);
    }
    if (fs.existsSync(tmpDir)) {
      const entries = await fsp.readdir(tmpDir);
      console.log(`[cleanup] wca_tmp: ${entries.length} files would be removed`);
    }
    for (const logName of ["wca_update.log", "wca_cron.log"]) {
      const logPath = path.join(logDir, logName);
      if (fs.existsSync(logPath)) {
        const content = await fsp.readFile(logPath, "utf8");
        const lines = content.split("\n").length;
        console.log(`[cleanup] ${logName}: ${lines} lines, would rotate to ${MAX_LOG_LINES}`);
      }
    }
  }

  console.log("\n[cleanup] done");
}

main().catch(async (error) => {
  console.error(`[cleanup] ERROR: ${error.message}`);
  process.exitCode = 1;
});
