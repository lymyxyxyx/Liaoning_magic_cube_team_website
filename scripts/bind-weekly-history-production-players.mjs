#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import yauzl from "yauzl";

const infoHeaders = ["meet_slug", "week_number", "title", "start_date", "end_date"];
const resultHeaders = ["event_code", "player_id", "wca_id", "player_name", "attempt_1", "attempt_2", "attempt_3", "attempt_4", "attempt_5", "notes"];
const resultsSheetPath = "xl/worksheets/sheet2.xml";
const maxZipEntryBytes = 4 * 1024 * 1024;
const maxWorkbookBytes = 16 * 1024 * 1024;
const lockedPlayerId = "weekly-player-f4c60479-f9a0-482c-a35c-f0fe8d2ceeb7";

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const inputPath = path.resolve(options.input);
  const resolutionPath = path.resolve(options.resolution);
  const outputPath = path.resolve(options.output);
  if (inputPath === outputPath) throw new Error("--input and --output must be different files");

  const [inputBuffer, resolutionText] = await Promise.all([
    fs.readFile(inputPath),
    fs.readFile(resolutionPath, "utf8")
  ]);
  if (inputBuffer.length > maxWorkbookBytes) throw new Error(`Input workbook is too large: ${inputBuffer.length} bytes`);

  const resolution = parseResolutionJson(resolutionText);
  const inputEntries = await readZipEntries(inputBuffer);
  const workbook = parseStandardWorkbook(inputEntries);
  const bound = bindPlayerIds(workbook.resultSheetXml, workbook.sharedStrings, resolution);

  const outputEntries = inputEntries.map((entry) => entry.name === resultsSheetPath
    ? { ...entry, data: Buffer.from(bound.xml, "utf8") }
    : entry);
  const outputBuffer = createStoredZip(outputEntries);
  const writtenEntries = await readZipEntries(outputBuffer);
  verifyPreservedWorkbook(inputEntries, writtenEntries, workbook, bound);

  await writeFileAtomically(outputPath, outputBuffer);
  const metadata = workbook.metadata;
  console.log(JSON.stringify({
    input: inputPath,
    resolution: resolutionPath,
    output: outputPath,
    meet_slug: metadata.meet_slug,
    week_number: Number(metadata.week_number),
    results: bound.rows.length,
    attempts: bound.rows.reduce((sum, row) => sum + row.attempts.filter(Boolean).length, 0),
    competitors: new Set(bound.rows.map((row) => row.playerId)).size,
    player_id_nonempty: bound.rows.filter((row) => row.playerId).length,
    dnf: bound.rows.flatMap((row) => row.attempts).filter((value) => value === "DNF").length,
    dns: bound.rows.flatMap((row) => row.attempts).filter((value) => value === "DNS").length,
    unresolved: 0,
    input_sha256: sha256(inputBuffer),
    output_sha256: sha256(outputBuffer)
  }, null, 2));
}

function parseOptions(args) {
  if (args.includes("--help") || args.includes("-h")) return { help: true };
  const allowed = new Set(["--input", "--resolution", "--output"]);
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!allowed.has(name) || !value || value.startsWith("--")) throw new Error(`Invalid option near ${name || "(end of arguments)"}`);
    if (values[name]) throw new Error(`Duplicate option: ${name}`);
    values[name] = value;
  }
  for (const name of allowed) if (!values[name]) throw new Error(`Required: ${name} /path/to/file`);
  return { input: values["--input"], resolution: values["--resolution"], output: values["--output"], help: false };
}

function printUsage() {
  console.log([
    "Usage:",
    "  node scripts/bind-weekly-history-production-players.mjs \\",
    "    --input /path/to/2026-week-28-standard.xlsx \\",
    "    --resolution /path/to/production-player-resolution.json \\",
    "    --output /path/to/2026-week-28-production.xlsx"
  ].join("\n"));
}

function parseResolutionJson(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("Resolution file is not valid JSON"); }
  if (!parsed || !Array.isArray(parsed.players) || !parsed.players.length) throw new Error("Resolution JSON must contain a non-empty players array");

  const bySourceName = new Map();
  const byResolutionKey = new Map();
  const playerIds = new Set();
  for (const [index, player] of parsed.players.entries()) {
    const label = `Resolution player ${index + 1}`;
    const sourceName = requiredString(player?.source_name, `${label} source_name`);
    const resolutionKey = requiredString(player?.resolution_key, `${label} resolution_key`);
    const playerId = requiredString(player?.production_player_id, `${label} production_player_id`);
    if (!/^weekly-player-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playerId)) throw new Error(`${label} has an invalid production_player_id`);
    if (bySourceName.has(sourceName)) throw new Error(`Duplicate source_name in resolution JSON: ${sourceName}`);
    if (byResolutionKey.has(resolutionKey)) throw new Error(`Duplicate resolution_key in resolution JSON: ${resolutionKey}`);
    if (playerIds.has(playerId)) throw new Error(`Duplicate production_player_id in resolution JSON: ${playerId}`);
    const item = { sourceName, resolutionKey, playerId };
    bySourceName.set(sourceName, item);
    byResolutionKey.set(resolutionKey, item);
    playerIds.add(playerId);
  }

  const locked = bySourceName.get("李柏bo霖");
  if (!locked || locked.playerId !== lockedPlayerId) throw new Error(`李柏bo霖 must resolve to ${lockedPlayerId}`);
  return { bySourceName, byResolutionKey };
}

function parseStandardWorkbook(entries) {
  const entryMap = new Map(entries.map((entry) => [entry.name, entry.data]));
  for (const required of ["xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/worksheets/sheet1.xml", resultsSheetPath]) {
    if (!entryMap.has(required)) throw new Error(`Standard workbook is missing ${required}`);
  }

  const workbookXml = entryMap.get("xl/workbook.xml").toString("utf8");
  const relationshipsXml = entryMap.get("xl/_rels/workbook.xml.rels").toString("utf8");
  const sheets = Array.from(workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)).map((match) => ({
    name: decodeXml(readXmlAttribute(match[1], "name")),
    relationshipId: readXmlAttribute(match[1], "r:id")
  }));
  if (sheets.length !== 2 || sheets[0]?.name !== "比赛信息" || sheets[1]?.name !== "成绩") throw new Error("Workbook must contain only the standard 比赛信息 and 成绩 sheets");

  const targets = new Map(Array.from(relationshipsXml.matchAll(/<Relationship\b([^>]*)\/>/g)).map((match) => [
    readXmlAttribute(match[1], "Id"),
    normalizeWorkbookTarget(readXmlAttribute(match[1], "Target"))
  ]));
  if (targets.get(sheets[0].relationshipId) !== "xl/worksheets/sheet1.xml" || targets.get(sheets[1].relationshipId) !== resultsSheetPath) throw new Error("Standard workbook sheet relationships are incorrect");

  const sharedStrings = parseSharedStrings(entryMap.get("xl/sharedStrings.xml")?.toString("utf8") || "");
  const infoRows = parseSheetRows(entryMap.get("xl/worksheets/sheet1.xml").toString("utf8"), sharedStrings);
  const resultSheetXml = entryMap.get(resultsSheetPath).toString("utf8");
  const resultRows = parseSheetRows(resultSheetXml, sharedStrings);
  assertExactHeaders(rowValues(infoRows[0]), infoHeaders, "比赛信息");
  assertExactHeaders(rowValues(resultRows[0]), resultHeaders, "成绩");
  if (!infoRows[1]) throw new Error("比赛信息 is missing its data row");
  const infoValues = rowValues(infoRows[1]);
  const metadata = Object.fromEntries(infoHeaders.map((header, index) => [header, infoValues[index] || ""]));
  return { metadata, resultSheetXml, resultRows, sharedStrings };
}

function bindPlayerIds(xml, sharedStrings, resolution) {
  const parsedRows = parseSheetRows(xml, sharedStrings);
  const rows = [];
  const replacements = [];
  for (const row of parsedRows.slice(1)) {
    const values = rowValues(row, resultHeaders.length);
    if (!values.some((value) => value.trim())) continue;
    if (values[1].trim()) throw new Error(`成绩 row ${row.rowNumber} already has player_id; expected a standard pre-production workbook`);

    const sourceName = readAuditField(values[9], "source_player_name");
    const resolutionKey = readAuditField(values[9], "resolution_key");
    if (!sourceName || !resolutionKey) throw new Error(`成绩 row ${row.rowNumber} is missing source_player_name or resolution_key in notes`);
    const sourceMatch = resolution.bySourceName.get(sourceName);
    const keyMatch = resolution.byResolutionKey.get(resolutionKey);
    if (!sourceMatch || !keyMatch) throw new Error(`Unresolved production player at 成绩 row ${row.rowNumber}: ${sourceName} / ${resolutionKey}`);
    if (sourceMatch !== keyMatch) throw new Error(`Conflicting production resolution at 成绩 row ${row.rowNumber}: ${sourceName} / ${resolutionKey}`);

    const playerId = sourceMatch.playerId;
    const cell = row.cells.find((item) => item.column === 2);
    const cellXml = `<c r="B${row.rowNumber}" t="inlineStr"><is><t>${escapeXml(playerId)}</t></is></c>`;
    if (cell) replacements.push({ start: cell.start, end: cell.end, xml: cellXml });
    else {
      const previousCell = row.cells.filter((item) => item.column < 2).at(-1);
      if (!previousCell) throw new Error(`成绩 row ${row.rowNumber} has no position for player_id`);
      replacements.push({ start: previousCell.end, end: previousCell.end, xml: cellXml });
    }
    rows.push({ rowNumber: row.rowNumber, playerId, attempts: values.slice(4, 9) });
  }
  if (!rows.length) throw new Error("成绩 sheet has no result rows");

  let output = xml;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    output = output.slice(0, replacement.start) + replacement.xml + output.slice(replacement.end);
  }
  return { xml: output, rows };
}

function verifyPreservedWorkbook(inputEntries, outputEntries, inputWorkbook, bound) {
  const outputByName = new Map(outputEntries.map((entry) => [entry.name, entry.data]));
  if (outputEntries.length !== inputEntries.length) throw new Error("Output workbook ZIP entry count changed unexpectedly");
  for (const inputEntry of inputEntries) {
    const outputData = outputByName.get(inputEntry.name);
    if (!outputData) throw new Error(`Output workbook lost ZIP entry: ${inputEntry.name}`);
    if (inputEntry.name !== resultsSheetPath && !inputEntry.data.equals(outputData)) throw new Error(`Output workbook changed unrelated ZIP entry: ${inputEntry.name}`);
  }

  const outputWorkbook = parseStandardWorkbook(outputEntries);
  if (JSON.stringify(outputWorkbook.metadata) !== JSON.stringify(inputWorkbook.metadata)) throw new Error("Output workbook metadata changed unexpectedly");
  const beforeRows = inputWorkbook.resultRows.slice(1).filter((row) => rowValues(row, resultHeaders.length).some((value) => value.trim()));
  const afterRows = outputWorkbook.resultRows.slice(1).filter((row) => rowValues(row, resultHeaders.length).some((value) => value.trim()));
  if (beforeRows.length !== afterRows.length || afterRows.length !== bound.rows.length) throw new Error("Output workbook result row count changed unexpectedly");
  for (let index = 0; index < beforeRows.length; index += 1) {
    const before = rowValues(beforeRows[index], resultHeaders.length);
    const after = rowValues(afterRows[index], resultHeaders.length);
    if (beforeRows[index].rowNumber !== afterRows[index].rowNumber) throw new Error("Output workbook result row positions changed unexpectedly");
    if (after[1] !== bound.rows[index].playerId) throw new Error(`Output workbook player_id verification failed at row ${afterRows[index].rowNumber}`);
    for (let column = 0; column < resultHeaders.length; column += 1) {
      if (column !== 1 && before[column] !== after[column]) throw new Error(`Output workbook changed ${resultHeaders[column]} at row ${afterRows[index].rowNumber}`);
    }
  }
}

async function readZipEntries(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zipFile) => {
      if (error || !zipFile) { reject(error || new Error("Could not read XLSX file")); return; }
      const entries = [];
      let totalBytes = 0;
      zipFile.readEntry();
      zipFile.on("entry", async (entry) => {
        try {
          if (entry.uncompressedSize > maxZipEntryBytes) throw new Error(`Workbook entry is too large: ${entry.fileName}`);
          totalBytes += entry.uncompressedSize;
          if (totalBytes > maxWorkbookBytes) throw new Error("Workbook uncompressed content is too large");
          const stream = await openZipEntry(zipFile, entry);
          entries.push({ name: entry.fileName, data: await streamToBuffer(stream) });
          zipFile.readEntry();
        } catch (entryError) {
          zipFile.close();
          reject(entryError);
        }
      });
      zipFile.on("end", () => resolve(entries));
      zipFile.on("error", reject);
    });
  });
}

function openZipEntry(zipFile, entry) {
  return new Promise((resolve, reject) => zipFile.openReadStream(entry, (error, stream) => error || !stream
    ? reject(error || new Error(`Could not read workbook entry: ${entry.fileName}`))
    : resolve(stream)));
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function parseSharedStrings(xml) {
  return Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)).map((match) => Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map((part) => decodeXml(part[1])).join(""));
}

function parseSheetRows(xml, sharedStrings) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(readXmlAttribute(rowMatch[1], "r"));
    if (!Number.isInteger(rowNumber) || rowNumber < 1) continue;
    const rowBodyStart = rowMatch.index + rowMatch[0].indexOf(rowMatch[2]);
    const cells = [];
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const reference = readXmlAttribute(cellMatch[1], "r");
      const type = readXmlAttribute(cellMatch[1], "t");
      const cellXml = cellMatch[2] || "";
      const raw = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
      const inline = cellXml.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)?.[1] ?? "";
      const encoded = inline ? Array.from(inline.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map((part) => part[1]).join("") : raw;
      const decoded = decodeXml(encoded);
      const start = rowBodyStart + cellMatch.index;
      cells.push({
        column: columnNumber(reference),
        value: type === "s" ? sharedStrings[Number(decoded)] || "" : decoded,
        start,
        end: start + cellMatch[0].length
      });
    }
    rows.push({ rowNumber, cells });
  }
  return rows;
}

function rowValues(row, width) {
  if (!row) return [];
  const values = new Map(row.cells.map((cell) => [cell.column, cell.value.trim()]));
  const length = width || Math.max(0, ...values.keys());
  return Array.from({ length }, (_, index) => values.get(index + 1) || "");
}

function assertExactHeaders(actual, expected, sheetName) {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) throw new Error(`${sheetName} headers do not match the standard template`);
}

function readAuditField(notes, field) {
  const prefix = `${field}=`;
  return notes.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length).trim() || "";
}

function normalizeWorkbookTarget(target) {
  if (target.startsWith("/")) return target.replace(/^\/+/, "");
  return target.startsWith("xl/") ? target : `xl/${target}`;
}

function readXmlAttribute(value, name) {
  return value.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || "";
}

function columnNumber(reference) {
  const letters = reference.match(/^[A-Z]+/)?.[0] || "";
  return [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0);
}

function decodeXml(value) {
  return value.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function createStoredZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    local.push(localHeader, name, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);
    offset += localHeader.length + name.length + entry.data.length;
  }
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...local, centralBuffer, end]);
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function writeFileAtomically(outputPath, data) {
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });
  const temporaryPath = path.join(outputDir, `.${path.basename(outputPath)}.${process.pid}.tmp`);
  try {
    await fs.writeFile(temporaryPath, data);
    await fs.rename(temporaryPath, outputPath);
  } catch (error) {
    await fs.unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
