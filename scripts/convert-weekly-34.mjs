#!/usr/bin/env node
/**
 * One-off adapter for the 2026 week 34 historical workbook.
 *
 * This intentionally has no database code. It extracts only the five raw
 * event sheets and produces the v1 standard results workbook consumed by the
 * existing results importer. It is not a general historical-workbook parser.
 *
 * Usage:
 *   node scripts/convert-weekly-34.mjs \
 *     --input /path/to/2026第34周周赛统计表(1).xlsx \
 *     --output /tmp/weekly-34-standard.xlsx \
 *     --slug test-2026-week-34 --title 'P0-3D test: 2026 第34周' \
 *     --start-date 2026-08-17 --end-date 2026-08-23
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import yauzl from "yauzl";

const standardInfoHeaders = ["meet_slug", "week_number", "title", "start_date", "end_date"];
const standardResultHeaders = ["event_code", "player_id", "wca_id", "player_name", "attempt_1", "attempt_2", "attempt_3", "attempt_4", "attempt_5", "notes"];
const sourceSheets = [
  { sheetName: "三阶", eventCode: "333" },
  { sheetName: "二阶", eventCode: "222" },
  { sheetName: "金字塔", eventCode: "pyram" },
  { sheetName: "枫叶", eventCode: "maple" },
  { sheetName: "镜面", eventCode: "mirror" }
];
const maxZipEntryBytes = 4 * 1024 * 1024;

async function main() {
  const options = readOptions(process.argv.slice(2));
  const sourceBuffer = await fs.readFile(options.input);
  const workbook = await parseWorkbook(sourceBuffer);
  const converted = sourceSheets.flatMap((config) => convertSourceSheet(workbook, config));
  const totals = assertAcceptanceTotals(converted);
  const output = createStandardWorkbook({
    slug: options.slug,
    weekNumber: 34,
    title: options.title,
    startDate: options.startDate,
    endDate: options.endDate,
    rows: converted.map((row) => [
      row.eventCode, "", "", row.playerName,
      ...row.attempts, row.notes
    ])
  });
  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, output);
  const report = {
    converter: "convert-weekly-34.mjs",
    sourceFile: path.basename(options.input),
    sourceSha256: createHash("sha256").update(sourceBuffer).digest("hex"),
    outputFile: path.basename(options.output),
    metadata: { meet_slug: options.slug, week_number: "34", title: options.title, start_date: options.startDate, end_date: options.endDate },
    sourceSheets: sourceSheets.map(({ sheetName, eventCode }) => ({ sheetName, eventCode })),
    totals,
    averageChecks: converted.map((row) => ({
      eventCode: row.eventCode,
      playerName: row.playerName,
      sourceRow: row.sourceRow,
      attempts: row.attempts,
      excelAverage: row.excelAverage,
      calculatedAverage: row.calculatedAverage,
      matches: row.excelAverage === row.calculatedAverage
    })),
    notes: [
      "Only raw T1-T5 rows from the five configured sheets were converted.",
      "Ranking, best, PB, all-around, age-group, and display sheets are not imported.",
      "player_id and wca_id are deliberately blank for the formal player-matching preview."
    ]
  };
  await fs.writeFile(`${options.output}.report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ output: options.output, report: `${options.output}.report.json`, totals }, null, 2));
}

function readOptions(args) {
  const value = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : "";
  };
  const input = value("--input");
  const output = value("--output");
  const slug = value("--slug");
  const title = value("--title");
  const startDate = value("--start-date");
  const endDate = value("--end-date");
  if (!input || !output || !slug || !title || !isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw new Error("Required: --input, --output, --slug, --title, --start-date YYYY-MM-DD, --end-date YYYY-MM-DD");
  }
  return { input, output, slug, title, startDate, endDate };
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function convertSourceSheet(workbook, config) {
  const rows = workbook.sheets.get(config.sheetName);
  if (!rows) throw new Error(`Source workbook is missing the required raw sheet: ${config.sheetName}`);
  const headerRow = rows.find((row) => findColumn(row, "姓名") >= 0 && findColumn(row, "T1") >= 0);
  if (!headerRow) throw new Error(`${config.sheetName} does not have a readable raw T1-T5 header row`);
  const nameColumn = findColumn(headerRow, "姓名");
  const attemptColumns = ["T1", "T2", "T3", "T4", "T5"].map((header) => findColumn(headerRow, header));
  const averageColumn = findColumn(headerRow, "平均");
  const ageGroupColumn = findColumn(headerRow, "年龄组");
  if ([nameColumn, averageColumn, ageGroupColumn, ...attemptColumns].some((column) => column < 0)) {
    throw new Error(`${config.sheetName} is missing one of 姓名、年龄组、T1-T5、平均`);
  }
  const output = [];
  for (const row of rows.filter((candidate) => candidate.rowNumber > headerRow.rowNumber)) {
    const playerName = readCell(row, nameColumn).trim();
    const sourceAttempts = attemptColumns.map((column) => readCell(row, column).trim());
    if (!playerName && sourceAttempts.every((value) => !value)) continue;
    if (!sourceAttempts.some((value) => value)) continue; // the historical sheets contain roster-only rows below completed results
    if (!playerName || sourceAttempts.some((value) => !value)) throw new Error(`${config.sheetName} row ${row.rowNumber} has a partial raw result`);
    const attempts = sourceAttempts.map((value) => normalizeAttempt(value));
    const excelAverage = parseCentiseconds(readCell(row, averageColumn), `${config.sheetName} row ${row.rowNumber} 平均`);
    const calculatedAverage = calculateAvg5(attempts);
    if (excelAverage !== calculatedAverage) {
      throw new Error(JSON.stringify({
        error: "Historical avg5 validation failed",
        player: playerName,
        event: config.eventCode,
        sourceRow: row.rowNumber,
        attempts,
        excelAverage: formatCentiseconds(excelAverage),
        calculatedAverage: formatCentiseconds(calculatedAverage)
      }));
    }
    const ageGroup = readCell(row, ageGroupColumn).trim();
    output.push({
      eventCode: config.eventCode,
      playerName,
      attempts,
      excelAverage: formatCentiseconds(excelAverage),
      calculatedAverage: formatCentiseconds(calculatedAverage),
      sourceRow: row.rowNumber,
      notes: `source_sheet=${config.sheetName}; source_row=${row.rowNumber}; source_age_group=${ageGroup}; source_average=${formatCentiseconds(excelAverage)}`
    });
  }
  if (!output.length) throw new Error(`${config.sheetName} has no complete raw T1-T5 rows`);
  return output;
}

function findColumn(row, header) {
  for (const cell of row.cells) if (cell.value.trim() === header) return cell.column;
  return -1;
}

function readCell(row, column) {
  return row.cells.find((cell) => cell.column === column)?.value ?? "";
}

function normalizeAttempt(value) {
  const clean = String(value).trim().toUpperCase();
  if (clean === "DNF" || clean === "DNS") return clean;
  const centiseconds = parseCentiseconds(clean, "attempt");
  return formatCentiseconds(centiseconds);
}

function parseCentiseconds(value, label) {
  const clean = String(value).trim();
  if (!clean || !/^\d+(?::\d{1,2})?(?:\.\d+)?$/.test(clean)) throw new Error(`${label} is not a supported result value: ${clean || "(blank)"}`);
  const pieces = clean.split(":");
  const seconds = pieces.length === 2 ? Number(pieces[0]) * 60 + Number(pieces[1]) : Number(pieces[0]);
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`${label} is not a supported result value: ${clean}`);
  return Math.round(seconds * 100);
}

function calculateAvg5(attempts) {
  const numeric = attempts.filter((value) => value !== "DNF" && value !== "DNS").map((value) => parseCentiseconds(value, "attempt"));
  const invalid = attempts.length - numeric.length;
  if (invalid >= 2 || numeric.length < 3) return null;
  const sorted = [...numeric].sort((a, b) => a - b);
  return invalid === 1 ? Math.round(sorted.slice(1).reduce((sum, value) => sum + value, 0) / 3) : Math.round(sorted.slice(1, 4).reduce((sum, value) => sum + value, 0) / 3);
}

function formatCentiseconds(value) {
  if (value === null) return "DNF";
  const minutes = Math.floor(value / 6000);
  const rest = value % 6000;
  const seconds = Math.floor(rest / 100);
  const centiseconds = rest % 100;
  return minutes ? `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}` : `${seconds}.${String(centiseconds).padStart(2, "0")}`;
}

function assertAcceptanceTotals(rows) {
  const totals = {
    uniquePlayers: new Set(rows.map((row) => row.playerName)).size,
    events: new Set(rows.map((row) => row.eventCode)).size,
    results: rows.length,
    attempts: rows.reduce((total, row) => total + row.attempts.length, 0)
  };
  const expected = { uniquePlayers: 20, events: 5, results: 40, attempts: 200 };
  if (Object.entries(expected).some(([key, value]) => totals[key] !== value)) {
    throw new Error(`Unexpected conversion totals: ${JSON.stringify(totals)}; expected baseline ${JSON.stringify(expected)}`);
  }
  return totals;
}

async function parseWorkbook(buffer) {
  const entries = await readZipEntries(buffer);
  const workbookXml = entries.get("xl/workbook.xml") || "";
  const relationshipsXml = entries.get("xl/_rels/workbook.xml.rels") || "";
  const sheets = Array.from(workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)).map((match) => ({ name: decodeXml(attribute(match[1], "name")), relationshipId: attribute(match[1], "r:id") }));
  const relationshipTargets = new Map(Array.from(relationshipsXml.matchAll(/<Relationship\b([^>]*)\/>/g)).map((match) => [attribute(match[1], "Id"), `xl/${attribute(match[1], "Target").replace(/^\/+/, "")}`]));
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml") || "");
  const parsedSheets = new Map();
  for (const sheet of sheets) {
    const target = relationshipTargets.get(sheet.relationshipId);
    if (!target || !entries.has(target)) continue;
    parsedSheets.set(sheet.name, parseSheetRows(entries.get(target), sharedStrings));
  }
  return { sheets: parsedSheets };
}

async function readZipEntries(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zipFile) => {
      if (error || !zipFile) return reject(error || new Error("Could not read workbook"));
      const entries = new Map();
      zipFile.readEntry();
      zipFile.on("entry", async (entry) => {
        try {
          if (entry.uncompressedSize > maxZipEntryBytes) throw new Error(`Workbook entry is too large: ${entry.fileName}`);
          const stream = await openZipEntry(zipFile, entry);
          entries.set(entry.fileName, await streamToString(stream));
          zipFile.readEntry();
        } catch (entryError) { zipFile.close(); reject(entryError); }
      });
      zipFile.on("end", () => resolve(entries));
      zipFile.on("error", reject);
    });
  });
}

function openZipEntry(zipFile, entry) {
  return new Promise((resolve, reject) => zipFile.openReadStream(entry, (error, stream) => error || !stream ? reject(error || new Error("Could not read workbook entry")) : resolve(stream)));
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function parseSharedStrings(xml) {
  return Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)).map((match) => Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map((part) => decodeXml(part[1])).join(""));
}

function parseSheetRows(xml, sharedStrings) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(attribute(rowMatch[1], "r"));
    if (!Number.isInteger(rowNumber)) continue;
    const cells = [];
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const reference = attribute(cellMatch[1], "r");
      const type = attribute(cellMatch[1], "t");
      const cellXml = cellMatch[2] || "";
      const raw = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
      const inline = cellXml.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)?.[1] ?? "";
      const value = inline ? Array.from(inline.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map((part) => decodeXml(part[1])).join("") : decodeXml(raw);
      cells.push({ column: columnNumber(reference), value: type === "s" ? sharedStrings[Number(value)] || "" : value });
    }
    rows.push({ rowNumber, cells });
  }
  return rows;
}

function attribute(value, name) { return value.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || ""; }
function columnNumber(reference) { const letters = reference.match(/^[A-Z]+/)?.[0] || ""; return [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0); }
function decodeXml(value) { return value.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16))).replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10))).replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); }

function createStandardWorkbook({ slug, weekNumber, title, startDate, endDate, rows }) {
  const entries = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="比赛信息" sheetId="1" r:id="rId1"/><sheet name="成绩" sheetId="2" r:id="rId2"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`],
    ["xl/worksheets/sheet1.xml", worksheetXml([standardInfoHeaders, [slug, String(weekNumber), title, startDate, endDate]])],
    ["xl/worksheets/sheet2.xml", worksheetXml([standardResultHeaders, ...rows])]
  ];
  return createStoredZip(entries.map(([name, content]) => ({ name, data: Buffer.from(content, "utf8") })));
}

function worksheetXml(rows) { return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => `<c r="${columnName(columnIndex + 1)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`; }
function columnName(column) { let value = column; let name = ""; while (value > 0) { const remainder = (value - 1) % 26; name = String.fromCharCode(65 + remainder) + name; value = Math.floor((value - 1) / 26); } return name; }
function escapeXml(value) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;"); }

function createStoredZip(entries) {
  const local = []; const central = []; let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name); const crc = crc32(entry.data); const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); localHeader.writeUInt16LE(20, 4); localHeader.writeUInt16LE(0, 6); localHeader.writeUInt16LE(0, 8); localHeader.writeUInt16LE(0, 10); localHeader.writeUInt16LE(0, 12); localHeader.writeUInt32LE(crc, 14); localHeader.writeUInt32LE(entry.data.length, 18); localHeader.writeUInt32LE(entry.data.length, 22); localHeader.writeUInt16LE(name.length, 26); localHeader.writeUInt16LE(0, 28); local.push(localHeader, name, entry.data);
    const centralHeader = Buffer.alloc(46); centralHeader.writeUInt32LE(0x02014b50, 0); centralHeader.writeUInt16LE(20, 4); centralHeader.writeUInt16LE(20, 6); centralHeader.writeUInt16LE(0, 8); centralHeader.writeUInt16LE(0, 10); centralHeader.writeUInt16LE(0, 12); centralHeader.writeUInt16LE(0, 14); centralHeader.writeUInt32LE(crc, 16); centralHeader.writeUInt32LE(entry.data.length, 20); centralHeader.writeUInt32LE(entry.data.length, 24); centralHeader.writeUInt16LE(name.length, 28); centralHeader.writeUInt16LE(0, 30); centralHeader.writeUInt16LE(0, 32); centralHeader.writeUInt16LE(0, 34); centralHeader.writeUInt16LE(0, 36); centralHeader.writeUInt32LE(0, 38); centralHeader.writeUInt32LE(offset, 42); central.push(centralHeader, name); offset += localHeader.length + name.length + entry.data.length;
  }
  const centralBuffer = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralBuffer.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20); return Buffer.concat([...local, centralBuffer, end]);
}
function crc32(data) { let crc = 0xffffffff; for (const byte of data) { crc ^= byte; for (let index = 0; index < 8; index += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
