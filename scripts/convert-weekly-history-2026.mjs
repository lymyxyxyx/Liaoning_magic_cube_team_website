#!/usr/bin/env node
/**
 * One-time converter for the approved 2026 week 27-34 historical batch.
 *
 * This tool is intentionally bounded to the six known raw sheets and the
 * explicit player decisions in its batch config. It does not modify the
 * long-term XLSX parser and contains no database code.
 *
 * Usage:
 *   WEEKLY_ARTIFACT_TOOL_MODULE=/absolute/path/to/artifact_tool.mjs \
 *   node scripts/convert-weekly-history-2026.mjs \
 *     --config scripts/weekly-history-2026-w27-w34.config.json \
 *     --source-root /absolute/path/to/private/source-files
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import yauzl from "yauzl";

const standardInfoHeaders = ["meet_slug", "week_number", "title", "start_date", "end_date"];
const standardResultHeaders = ["event_code", "player_id", "wca_id", "player_name", "attempt_1", "attempt_2", "attempt_3", "attempt_4", "attempt_5", "notes"];
const avg5Sheets = [
  { sheetName: "三阶", eventCode: "333" },
  { sheetName: "二阶", eventCode: "222" },
  { sheetName: "金字塔", eventCode: "pyram" },
  { sheetName: "枫叶", eventCode: "maple" },
  { sheetName: "镜面", eventCode: "mirror" }
];
const individualSheet = { sheetName: "个人全能", eventCode: "individual" };
const supportedWeeks = new Set([27, 28, 29, 30, 31, 32, 33, 34]);
const maxZipEntryBytes = 4 * 1024 * 1024;

async function main() {
  const args = process.argv.slice(2);
  const configPath = readOption(args, "--config");
  if (!configPath) throw new Error("Required: --config /path/to/weekly-history-batch.json");
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  validateBatchConfig(config);

  const artifactModule = process.env.WEEKLY_ARTIFACT_TOOL_MODULE || "@oai/artifact-tool";
  const { SpreadsheetFile, Workbook } = await import(artifactModule);
  const configDir = path.dirname(path.resolve(configPath));
  const sourceRootOption = readOption(args, "--source-root");
  const sourceRoot = sourceRootOption ? path.resolve(sourceRootOption) : resolveConfigPath(configDir, config.source_root);
  const rosterPath = resolveConfigPath(sourceRoot, config.roster_file);
  const outputDir = resolveConfigPath(configDir, config.output_dir);
  await fs.mkdir(outputDir, { recursive: true });

  const rosterBuffer = await fs.readFile(rosterPath);
  const roster = parseRoster(await parseWorkbook(rosterBuffer));
  if (roster.length !== config.controls.roster_rows) {
    throw new Error(`Roster control failed: ${roster.length} rows; expected ${config.controls.roster_rows}`);
  }

  const convertedWeeks = [];
  for (const weekConfig of config.weeks) {
    const sourcePath = resolveConfigPath(sourceRoot, weekConfig.source_file);
    const sourceBuffer = await fs.readFile(sourcePath);
    const workbook = await parseWorkbook(sourceBuffer);
    const avg5Rows = avg5Sheets.flatMap((sheet) => convertAvg5Sheet(workbook, sheet));
    const individualRows = convertIndividualSheet(workbook, individualSheet);
    convertedWeeks.push({ weekConfig, sourcePath, sourceBuffer, rows: [...avg5Rows, ...individualRows], avg5Rows, individualRows });
  }

  const resolution = buildResolutionManifest(config, roster, convertedWeeks);
  resolution.roster_source_sha256 = sha256(rosterBuffer);
  const resolutionPath = path.join(outputDir, "player-resolution-manifest.json");
  await fs.writeFile(resolutionPath, `${JSON.stringify(resolution, null, 2)}\n`);

  const reports = [];
  for (const converted of convertedWeeks) {
    const rows = converted.rows.map((row) => applyResolution(row, resolution));
    const controls = summarizeRows(rows);
    assertWeekControls(converted.weekConfig, controls);
    const outputPath = path.join(outputDir, converted.weekConfig.output_file);
    await createStandardWorkbook({ Workbook, SpreadsheetFile, outputPath, metadata: converted.weekConfig, rows });
    const outputBuffer = await fs.readFile(outputPath);
    const outputValidation = validateStandardWorkbook(await parseWorkbook(outputBuffer), converted.weekConfig, controls);
    const report = {
      converter: "convert-weekly-history-2026.mjs",
      schema_version: config.schema_version,
      source_file: path.basename(converted.sourcePath),
      source_sha256: sha256(converted.sourceBuffer),
      output_file: path.basename(outputPath),
      output_sha256: sha256(outputBuffer),
      metadata: metadataObject(converted.weekConfig),
      source_sheets: [
        ...avg5Sheets.map((item) => ({ sheet_name: item.sheetName, event_code: item.eventCode, format: "avg5", attempt_count: 5 })),
        { sheet_name: individualSheet.sheetName, event_code: individualSheet.eventCode, format: "best1", attempt_count: 1 }
      ],
      controls,
      output_validation: outputValidation,
      avg5_checks: converted.avg5Rows.map((row) => ({ event_code: row.eventCode, player_name: row.sourcePlayerName, source_sheet: row.sourceSheet, source_row: row.sourceRow, excel_average: row.excelAverage, calculated_average: row.calculatedAverage, matches: row.excelAverage === row.calculatedAverage })),
      individual_checks: converted.individualRows.map((row) => ({ player_name: row.sourcePlayerName, source_sheet: row.sourceSheet, source_row: row.sourceRow, attempt: row.attempts[0], format: "best1", matches: row.attempts.length === 1 })),
      dnf_dns: rows.filter((row) => row.attempts.some((value) => value === "DNF" || value === "DNS")).map((row) => ({ event_code: row.eventCode, player_name: row.sourcePlayerName, source_sheet: row.sourceSheet, source_row: row.sourceRow, attempts: row.attempts })),
      unresolved_players: []
    };
    const reportPath = `${outputPath}.report.json`;
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    reports.push({ ...report, output_path: outputPath, report_path: reportPath });
  }

  const audit = buildBatchAudit(config, resolution, reports);
  const auditPath = path.join(outputDir, "conversion-audit.json");
  await fs.writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  console.log(JSON.stringify({ output_dir: outputDir, resolution_manifest: resolutionPath, audit_report: auditPath, controls: audit.controls, files: reports.map((report) => report.output_path) }, null, 2));
}

function validateBatchConfig(config) {
  if (config.schema_version !== "weekly-history-2026-w27-w34-v1") throw new Error("Unsupported batch schema_version");
  if (!config.source_root || !config.roster_file || !config.output_dir) throw new Error("Config requires source_root, roster_file, and output_dir");
  if (!Array.isArray(config.weeks) || config.weeks.length !== 8) throw new Error("This one-time converter requires exactly eight week entries");
  const weeks = new Set();
  for (const item of config.weeks) {
    for (const key of ["week_number", "meet_slug", "title", "start_date", "end_date", "source_file", "output_file", "expected_results", "expected_attempts"]) {
      if (item[key] === undefined || item[key] === "") throw new Error(`Week config missing ${key}`);
    }
    if (!supportedWeeks.has(Number(item.week_number)) || weeks.has(Number(item.week_number))) throw new Error(`Unexpected or duplicate week_number: ${item.week_number}`);
    if (!isIsoDate(item.start_date) || !isIsoDate(item.end_date)) throw new Error(`Invalid date metadata for week ${item.week_number}`);
    weeks.add(Number(item.week_number));
  }
  if (Array.from(supportedWeeks).some((week) => !weeks.has(week))) throw new Error("Week config must cover W27-W34 exactly");
  if (!Array.isArray(config.resolutions?.explicit_create) || !Array.isArray(config.resolutions?.explicit_existing)) throw new Error("Config requires explicit player decisions");
}

function parseRoster(workbook) {
  const rows = workbook.sheets.get("Sheet1");
  if (!rows) throw new Error("Roster workbook is missing Sheet1");
  const header = rows.find((row) => findColumn(row, "姓名") >= 0 && findColumn(row, "性别") >= 0 && findColumn(row, "出生日期") >= 0);
  if (!header) throw new Error("Roster workbook is missing 姓名、性别、出生日期 headers");
  const nameColumn = findColumn(header, "姓名");
  const genderColumn = findColumn(header, "性别");
  const birthColumn = findColumn(header, "出生日期");
  return rows.filter((row) => row.rowNumber > header.rowNumber && readCell(row, nameColumn).trim()).map((row) => ({
    rosterRow: row.rowNumber,
    name: readCell(row, nameColumn).trim(),
    gender: readCell(row, genderColumn).trim(),
    birthDateSource: readCell(row, birthColumn).trim()
  }));
}

function convertAvg5Sheet(workbook, config) {
  const rows = workbook.sheets.get(config.sheetName);
  if (!rows) throw new Error(`Source workbook is missing required raw sheet: ${config.sheetName}`);
  const header = rows.find((row) => findColumn(row, "姓名") >= 0 && findColumn(row, "T1") >= 0);
  if (!header) throw new Error(`${config.sheetName} does not have a readable raw T1-T5 header row`);
  const nameColumn = findColumn(header, "姓名");
  const attemptColumns = ["T1", "T2", "T3", "T4", "T5"].map((name) => findColumn(header, name));
  const averageColumn = findColumn(header, "平均");
  const ageGroupColumn = findColumn(header, "年龄组");
  const genderColumn = findColumn(header, "性别");
  if ([nameColumn, averageColumn, ageGroupColumn, ...attemptColumns].some((column) => column < 0)) throw new Error(`${config.sheetName} is missing one of 姓名、年龄组、T1-T5、平均`);
  const output = [];
  for (const row of rows.filter((candidate) => candidate.rowNumber > header.rowNumber)) {
    const playerName = readCell(row, nameColumn).trim();
    const sourceAttempts = attemptColumns.map((column) => readCell(row, column).trim());
    if (!sourceAttempts.some(Boolean)) continue;
    if (!playerName || sourceAttempts.some((value) => !value)) throw new Error(`${config.sheetName} row ${row.rowNumber} has a partial raw result`);
    const attempts = sourceAttempts.map(normalizeAttempt);
    const excelAverageValue = parseCentiseconds(readCell(row, averageColumn), `${config.sheetName} row ${row.rowNumber} 平均`, true);
    const calculatedAverageValue = calculateAvg5(attempts);
    if (excelAverageValue !== calculatedAverageValue) throw new Error(`Historical avg5 validation failed: ${config.sheetName} row ${row.rowNumber} ${playerName}`);
    output.push({
      eventCode: config.eventCode,
      format: "avg5",
      sourceSheet: config.sheetName,
      sourceRow: row.rowNumber,
      sourcePlayerName: playerName,
      sourceAgeGroup: readCell(row, ageGroupColumn).trim(),
      sourceGender: genderColumn < 0 ? "" : readCell(row, genderColumn).trim(),
      attempts,
      excelAverage: formatCentiseconds(excelAverageValue),
      calculatedAverage: formatCentiseconds(calculatedAverageValue)
    });
  }
  if (!output.length) throw new Error(`${config.sheetName} has no complete raw T1-T5 rows`);
  return output;
}

function convertIndividualSheet(workbook, config) {
  const rows = workbook.sheets.get(config.sheetName);
  if (!rows) throw new Error(`Source workbook is missing required raw sheet: ${config.sheetName}`);
  const header = rows.find((row) => findColumn(row, "姓名") >= 0 && findColumn(row, "成绩") >= 0);
  if (!header) throw new Error(`${config.sheetName} does not have 姓名、年龄组、成绩 headers`);
  const nameColumn = findColumn(header, "姓名");
  const ageGroupColumn = findColumn(header, "年龄组");
  const scoreColumn = findColumn(header, "成绩");
  if ([nameColumn, ageGroupColumn, scoreColumn].some((column) => column < 0)) throw new Error(`${config.sheetName} is missing one of 姓名、年龄组、成绩`);
  const output = [];
  for (const row of rows.filter((candidate) => candidate.rowNumber > header.rowNumber)) {
    const playerName = readCell(row, nameColumn).trim();
    const score = readCell(row, scoreColumn).trim();
    if (!score) continue;
    if (!playerName) throw new Error(`${config.sheetName} row ${row.rowNumber} has a score without a player name`);
    output.push({
      eventCode: config.eventCode,
      format: "best1",
      sourceSheet: config.sheetName,
      sourceRow: row.rowNumber,
      sourcePlayerName: playerName,
      sourceAgeGroup: readCell(row, ageGroupColumn).trim(),
      sourceGender: "",
      attempts: [normalizeAttempt(score)],
      excelAverage: "",
      calculatedAverage: ""
    });
  }
  if (!output.length) throw new Error(`${config.sheetName} has no best1 results`);
  return output;
}

function buildResolutionManifest(config, roster, convertedWeeks) {
  const appearances = new Map();
  for (const converted of convertedWeeks) {
    for (const row of converted.rows) {
      const current = appearances.get(row.sourcePlayerName) || { weeks: new Set(), genders: new Set(), ageGroups: new Set() };
      current.weeks.add(Number(converted.weekConfig.week_number));
      if (row.sourceGender) current.genders.add(row.sourceGender);
      if (row.sourceAgeGroup) current.ageGroups.add(row.sourceAgeGroup);
      appearances.set(row.sourcePlayerName, current);
    }
  }
  const createNames = new Set(config.resolutions.explicit_create.map((item) => item.source_name));
  const explicitLinks = new Map(config.resolutions.explicit_existing.map((item) => [item.source_name, item]));
  const rosterByName = groupBy(roster, (item) => item.name);
  const players = [];
  const unresolved = [];
  for (const [sourceName, appearance] of [...appearances.entries()].sort(([left], [right]) => left.localeCompare(right, "zh-CN"))) {
    if (createNames.has(sourceName)) {
      const decision = config.resolutions.explicit_create.find((item) => item.source_name === sourceName);
      players.push({ source_name: sourceName, canonical_name: decision.canonical_name || sourceName, resolution_type: "explicit_create", resolution_key: `create:${sourceName}`, target: { action: "create", requested_record: { name: decision.canonical_name || sourceName, gender: decision.gender || [...appearance.genders][0] || "", birth_date: decision.birth_date || "", status: "active" } }, source_weeks: [...appearance.weeks].sort((a, b) => a - b), source_genders: [...appearance.genders], source_age_groups: [...appearance.ageGroups] });
      continue;
    }
    const explicit = explicitLinks.get(sourceName);
    if (explicit) {
      const target = roster.find((item) => item.rosterRow === Number(explicit.roster_row));
      if (!target || target.name !== explicit.canonical_name) throw new Error(`Explicit link target mismatch for ${sourceName}`);
      for (const forbiddenRow of explicit.forbidden_roster_rows || []) {
        if (!roster.some((item) => item.rosterRow === Number(forbiddenRow))) throw new Error(`Forbidden roster row not found for ${sourceName}: ${forbiddenRow}`);
      }
      players.push({ source_name: sourceName, canonical_name: target.name, resolution_type: "explicit_existing", resolution_key: `existing:roster-row-${target.rosterRow}`, target: { action: "link_existing", roster_row: target.rosterRow, canonical_name: target.name, identity_note: explicit.identity_note || "", forbidden_roster_rows: explicit.forbidden_roster_rows || [] }, source_weeks: [...appearance.weeks].sort((a, b) => a - b), source_genders: [...appearance.genders], source_age_groups: [...appearance.ageGroups] });
      continue;
    }
    const exact = rosterByName.get(sourceName) || [];
    if (exact.length === 1) {
      players.push({ source_name: sourceName, canonical_name: exact[0].name, resolution_type: "unique_exact_match", resolution_key: `existing:roster-row-${exact[0].rosterRow}`, target: { action: "link_existing", roster_row: exact[0].rosterRow, canonical_name: exact[0].name }, source_weeks: [...appearance.weeks].sort((a, b) => a - b), source_genders: [...appearance.genders], source_age_groups: [...appearance.ageGroups] });
    } else unresolved.push({ source_name: sourceName, exact_roster_rows: exact.map((item) => item.rosterRow) });
  }
  const counts = countBy(players, (item) => item.resolution_type);
  const expected = config.controls.resolution;
  if (unresolved.length || players.length !== expected.total || counts.unique_exact_match !== expected.unique_exact_match || counts.explicit_existing !== expected.explicit_existing || counts.explicit_create !== expected.explicit_create) {
    throw new Error(`Resolution controls failed: ${JSON.stringify({ players: players.length, counts, unresolved })}`);
  }
  return { schema_version: "weekly-history-player-resolution-v1", roster_source_file: config.roster_file, roster_source_sha256: "recorded-in-batch-audit", controls: { expected, actual: { total: players.length, ...counts }, unresolved_count: unresolved.length }, explicit_identity_rules: config.resolutions.explicit_existing, players, unresolved };
}

function applyResolution(row, resolution) {
  const player = resolution.players.find((item) => item.source_name === row.sourcePlayerName);
  if (!player) throw new Error(`Unresolved player in converted row: ${row.sourcePlayerName}`);
  const notes = [
    `source_sheet=${row.sourceSheet}`,
    `source_row=${row.sourceRow}`,
    `source_player_name=${row.sourcePlayerName}`,
    `resolution_key=${player.resolution_key}`,
    `resolution_type=${player.resolution_type}`,
    `source_age_group=${row.sourceAgeGroup}`
  ];
  if (row.excelAverage) notes.push(`source_average=${row.excelAverage}`);
  if (player.source_name === "李柏bo霖") notes.push("identity_lock=roster_row_497", "do_not_link_roster_row=419");
  return { ...row, playerName: player.canonical_name, resolutionKey: player.resolution_key, notes: notes.join("; ") };
}

function summarizeRows(rows) {
  const attempts = rows.reduce((total, row) => total + row.attempts.length, 0);
  const values = rows.flatMap((row) => row.attempts);
  const perEvent = Object.fromEntries([...groupBy(rows, (row) => row.eventCode).entries()].map(([eventCode, eventRows]) => [eventCode, { results: eventRows.length, attempts: eventRows.reduce((total, row) => total + row.attempts.length, 0) }]));
  return { unique_players: new Set(rows.map((row) => row.resolutionKey)).size, results: rows.length, attempts, avg5_results: rows.filter((row) => row.format === "avg5").length, individual_best1_results: rows.filter((row) => row.format === "best1").length, dnf: values.filter((value) => value === "DNF").length, dns: values.filter((value) => value === "DNS").length, per_event: perEvent };
}

function assertWeekControls(config, actual) {
  if (actual.results !== Number(config.expected_results) || actual.attempts !== Number(config.expected_attempts)) throw new Error(`W${config.week_number} control failed: ${actual.results}/${actual.attempts}; expected ${config.expected_results}/${config.expected_attempts}`);
}

async function createStandardWorkbook({ outputPath, metadata, rows }) {
  const info = [standardInfoHeaders, [metadata.meet_slug, String(metadata.week_number), metadata.title, metadata.start_date, metadata.end_date]];
  const results = [standardResultHeaders, ...rows.map((row) => [row.eventCode, "", "", row.playerName, ...row.attempts, ...Array.from({ length: 5 - row.attempts.length }, () => ""), row.notes])];
  const entries = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="比赛信息" sheetId="1" r:id="rId1"/><sheet name="成绩" sheetId="2" r:id="rId2"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`],
    ["xl/worksheets/sheet1.xml", worksheetXml(info)],
    ["xl/worksheets/sheet2.xml", worksheetXml(results)]
  ];
  await fs.writeFile(outputPath, createStoredZip(entries.map(([name, content]) => ({ name, data: Buffer.from(content, "utf8") }))));
}

function worksheetXml(rows) { return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => `<c r="${columnName(columnIndex + 1)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`; }
function columnName(column) { let value = column, name = ""; while (value > 0) { const remainder = (value - 1) % 26; name = String.fromCharCode(65 + remainder) + name; value = Math.floor((value - 1) / 26); } return name; }
function escapeXml(value) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function createStoredZip(entries) { const local = [], central = []; let offset = 0; for (const entry of entries) { const name = Buffer.from(entry.name), crc = crc32(entry.data), localHeader = Buffer.alloc(30), centralHeader = Buffer.alloc(46); localHeader.writeUInt32LE(0x04034b50, 0); localHeader.writeUInt16LE(20, 4); localHeader.writeUInt32LE(crc, 14); localHeader.writeUInt32LE(entry.data.length, 18); localHeader.writeUInt32LE(entry.data.length, 22); localHeader.writeUInt16LE(name.length, 26); local.push(localHeader, name, entry.data); centralHeader.writeUInt32LE(0x02014b50, 0); centralHeader.writeUInt16LE(20, 4); centralHeader.writeUInt16LE(20, 6); centralHeader.writeUInt32LE(crc, 16); centralHeader.writeUInt32LE(entry.data.length, 20); centralHeader.writeUInt32LE(entry.data.length, 24); centralHeader.writeUInt16LE(name.length, 28); centralHeader.writeUInt32LE(offset, 42); central.push(centralHeader, name); offset += localHeader.length + name.length + entry.data.length; } const centralBuffer = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralBuffer.length, 12); end.writeUInt32LE(offset, 16); return Buffer.concat([...local, centralBuffer, end]); }
function crc32(data) { let crc = 0xffffffff; for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }

function validateStandardWorkbook(workbook, metadata, expected) {
  const info = workbook.sheets.get("比赛信息");
  const results = workbook.sheets.get("成绩");
  if (!info || !results) throw new Error(`W${metadata.week_number} output workbook is missing required sheets`);
  if (workbook.sheets.size !== 2) throw new Error(`W${metadata.week_number} output workbook contains unexpected sheets`);
  const infoHeaders = info[0].cells.sort((a, b) => a.column - b.column).map((cell) => cell.value.trim());
  const resultHeaders = results[0].cells.sort((a, b) => a.column - b.column).map((cell) => cell.value.trim());
  if (JSON.stringify(infoHeaders) !== JSON.stringify(standardInfoHeaders) || JSON.stringify(resultHeaders) !== JSON.stringify(standardResultHeaders)) throw new Error(`W${metadata.week_number} output header validation failed`);
  if (results.length - 1 !== expected.results) throw new Error(`W${metadata.week_number} saved row count validation failed`);
  const metadataValues = info[1].cells.sort((a, b) => a.column - b.column).map((cell) => cell.value.trim());
  const expectedMetadata = [metadata.meet_slug, String(metadata.week_number), metadata.title, metadata.start_date, metadata.end_date];
  if (JSON.stringify(metadataValues) !== JSON.stringify(expectedMetadata)) throw new Error(`W${metadata.week_number} saved metadata validation failed`);
  const savedRows = results.slice(1).map((row) => {
    const valueByColumn = new Map(row.cells.map((cell) => [cell.column, cell.value.trim()]));
    const attempts = [5, 6, 7, 8, 9].map((column) => valueByColumn.get(column) || "");
    const notes = valueByColumn.get(10) || "";
    const resolutionKey = notes.match(/(?:^|; )resolution_key=([^;]+)/)?.[1] || "";
    return { eventCode: valueByColumn.get(1) || "", playerId: valueByColumn.get(2) || "", wcaId: valueByColumn.get(3) || "", playerName: valueByColumn.get(4) || "", attempts, notes, resolutionKey };
  });
  for (const row of savedRows) {
    const count = row.attempts.filter(Boolean).length;
    if (!row.playerName || !row.resolutionKey) throw new Error(`W${metadata.week_number} saved row is missing player identity audit data`);
    if (row.playerId || row.wcaId) throw new Error(`W${metadata.week_number} unexpectedly contains a database identity before preview`);
    if (row.eventCode === "individual" ? count !== 1 || row.attempts.slice(1).some(Boolean) : !avg5Sheets.some((item) => item.eventCode === row.eventCode) || count !== 5) throw new Error(`W${metadata.week_number} saved attempt shape is invalid for ${row.eventCode}`);
  }
  const savedValues = savedRows.flatMap((row) => row.attempts.filter(Boolean));
  const savedControls = {
    results: savedRows.length,
    attempts: savedValues.length,
    avg5_results: savedRows.filter((row) => row.eventCode !== "individual").length,
    individual_best1_results: savedRows.filter((row) => row.eventCode === "individual").length,
    dnf: savedValues.filter((value) => value === "DNF").length,
    dns: savedValues.filter((value) => value === "DNS").length,
    unique_players: new Set(savedRows.map((row) => row.resolutionKey)).size
  };
  for (const key of Object.keys(savedControls)) if (savedControls[key] !== expected[key]) throw new Error(`W${metadata.week_number} saved control failed for ${key}: ${savedControls[key]}; expected ${expected[key]}`);
  return { sheets: ["比赛信息", "成绩"], metadata_match: true, info_headers_match: true, result_headers_match: true, identity_audit_present: true, database_ids_blank_before_preview: true, controls: savedControls, all_passed: true };
}

function buildBatchAudit(config, resolution, reports) {
  const controls = {
    results: reports.reduce((sum, report) => sum + report.controls.results, 0),
    attempts: reports.reduce((sum, report) => sum + report.controls.attempts, 0),
    avg5_results: reports.reduce((sum, report) => sum + report.controls.avg5_results, 0),
    avg5_matches: reports.reduce((sum, report) => sum + report.avg5_checks.filter((item) => item.matches).length, 0),
    individual_best1_results: reports.reduce((sum, report) => sum + report.controls.individual_best1_results, 0),
    individual_best1_matches: reports.reduce((sum, report) => sum + report.individual_checks.filter((item) => item.matches).length, 0),
    dnf: reports.reduce((sum, report) => sum + report.controls.dnf, 0),
    dns: reports.reduce((sum, report) => sum + report.controls.dns, 0),
    unique_players: resolution.players.length,
    unresolved_players: resolution.unresolved.length
  };
  const expected = config.controls.batch;
  for (const [key, value] of Object.entries(expected)) if (controls[key] !== value) throw new Error(`Batch control failed for ${key}: ${controls[key]}; expected ${value}`);
  return {
    schema_version: "weekly-history-conversion-audit-v1",
    converter: "convert-weekly-history-2026.mjs",
    source_scope: "2026 W27-W34 only",
    ignored_sheets: config.ignored_sheets,
    roster: { source_file: config.roster_file, expected_rows: config.controls.roster_rows, expected_final_library_size_after_creates: config.controls.expected_final_library_size },
    resolution: resolution.controls,
    controls: { expected, actual: controls, all_passed: true },
    weeks: reports.map((report) => ({ week_number: Number(report.metadata.week_number), output_file: report.output_file, report_file: path.basename(report.report_path), controls: report.controls, output_sha256: report.output_sha256 })),
    dnf_details: reports.flatMap((report) => report.dnf_dns.map((item) => ({ week_number: Number(report.metadata.week_number), ...item }))),
    unresolved_players: resolution.unresolved,
    ready_statement: "8-week historical dataset ready for production preview"
  };
}

function readOption(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
function resolveConfigPath(base, value) { return path.isAbsolute(value) ? value : path.resolve(base, value); }
function metadataObject(item) { return { meet_slug: item.meet_slug, week_number: String(item.week_number), title: item.title, start_date: item.start_date, end_date: item.end_date }; }
function isIsoDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()); }
function sha256(buffer) { return createHash("sha256").update(buffer).digest("hex"); }
function groupBy(values, key) { const groups = new Map(); for (const value of values) { const itemKey = key(value); const group = groups.get(itemKey) || []; group.push(value); groups.set(itemKey, group); } return groups; }
function countBy(values, key) { const counts = {}; for (const value of values) { const itemKey = key(value); counts[itemKey] = (counts[itemKey] || 0) + 1; } return counts; }
function findColumn(row, header) { for (const cell of row.cells) if (cell.value.trim() === header) return cell.column; return -1; }
function readCell(row, column) { return row.cells.find((cell) => cell.column === column)?.value ?? ""; }
function normalizeAttempt(value) { const clean = String(value).trim().toUpperCase(); if (clean === "DNF" || clean === "DNS") return clean; return formatCentiseconds(parseCentiseconds(clean, "attempt", false)); }
function parseCentiseconds(value, label, allowDnf) { const clean = String(value).trim().toUpperCase(); if (allowDnf && clean === "DNF") return null; if (!clean || !/^\d+(?::\d{1,2})?(?:\.\d+)?$/.test(clean)) throw new Error(`${label} is not a supported result value: ${clean || "(blank)"}`); const pieces = clean.split(":"); const seconds = pieces.length === 2 ? Number(pieces[0]) * 60 + Number(pieces[1]) : Number(pieces[0]); if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`${label} is not a supported result value: ${clean}`); return Math.round(seconds * 100); }
function calculateAvg5(attempts) { const numeric = attempts.filter((value) => value !== "DNF" && value !== "DNS").map((value) => parseCentiseconds(value, "attempt", false)); const invalid = attempts.length - numeric.length; if (invalid >= 2 || numeric.length < 3) return null; const sorted = [...numeric].sort((a, b) => a - b); return invalid === 1 ? Math.round(sorted.slice(1).reduce((sum, value) => sum + value, 0) / 3) : Math.round(sorted.slice(1, 4).reduce((sum, value) => sum + value, 0) / 3); }
function formatCentiseconds(value) { if (value === null) return "DNF"; const minutes = Math.floor(value / 6000); const rest = value % 6000; const seconds = Math.floor(rest / 100); const centiseconds = rest % 100; return minutes ? `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}` : `${seconds}.${String(centiseconds).padStart(2, "0")}`; }

async function parseWorkbook(buffer) {
  const entries = await readZipEntries(buffer);
  const workbookXml = entries.get("xl/workbook.xml") || "";
  const relationshipsXml = entries.get("xl/_rels/workbook.xml.rels") || "";
  const sheets = Array.from(workbookXml.matchAll(/<(?:\w+:)?sheet\b([^>]*?)(?:\/>|>[\s\S]*?<\/(?:\w+:)?sheet>)/g)).map((match) => ({ name: decodeXml(attribute(match[1], "name")), relationshipId: attribute(match[1], "r:id") }));
  const relationshipTargets = new Map(Array.from(relationshipsXml.matchAll(/<Relationship\b([^>]*)\/>/g)).map((match) => [attribute(match[1], "Id"), normalizeWorkbookTarget(attribute(match[1], "Target"))]));
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml") || "");
  const parsedSheets = new Map();
  for (const sheet of sheets) { const target = relationshipTargets.get(sheet.relationshipId); if (!target || !entries.has(target)) continue; parsedSheets.set(sheet.name, parseSheetRows(entries.get(target), sharedStrings)); }
  return { sheets: parsedSheets };
}

function normalizeWorkbookTarget(target) { if (target.startsWith("/")) return target.replace(/^\/+/, ""); return target.startsWith("xl/") ? target : `xl/${target}`; }
async function readZipEntries(buffer) { return new Promise((resolve, reject) => { yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zipFile) => { if (error || !zipFile) return reject(error || new Error("Could not read workbook")); const entries = new Map(); zipFile.readEntry(); zipFile.on("entry", async (entry) => { try { if (entry.uncompressedSize > maxZipEntryBytes) throw new Error(`Workbook entry is too large: ${entry.fileName}`); const stream = await openZipEntry(zipFile, entry); entries.set(entry.fileName, await streamToString(stream)); zipFile.readEntry(); } catch (entryError) { zipFile.close(); reject(entryError); } }); zipFile.on("end", () => resolve(entries)); zipFile.on("error", reject); }); }); }
function openZipEntry(zipFile, entry) { return new Promise((resolve, reject) => zipFile.openReadStream(entry, (error, stream) => error || !stream ? reject(error || new Error("Could not read workbook entry")) : resolve(stream))); }
async function streamToString(stream) { const chunks = []; for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return Buffer.concat(chunks).toString("utf8"); }
function parseSharedStrings(xml) { return Array.from(xml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)).map((match) => Array.from(match[1].matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)).map((part) => decodeXml(part[1])).join("")); }
function parseSheetRows(xml, sharedStrings) { const rows = []; for (const rowMatch of xml.matchAll(/<(?:\w+:)?row\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?row>/g)) { const rowNumber = Number(attribute(rowMatch[1], "r")); if (!Number.isInteger(rowNumber)) continue; const cells = []; for (const cellMatch of rowMatch[2].matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) { const reference = attribute(cellMatch[1], "r"); const type = attribute(cellMatch[1], "t"); const cellXml = cellMatch[2] || ""; const raw = cellXml.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1] ?? ""; const inline = cellXml.match(/<(?:\w+:)?is\b[^>]*>([\s\S]*?)<\/(?:\w+:)?is>/)?.[1] ?? ""; const value = inline ? Array.from(inline.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)).map((part) => decodeXml(part[1])).join("") : decodeXml(raw); cells.push({ column: columnNumber(reference), value: type === "s" ? sharedStrings[Number(value)] || "" : value }); } rows.push({ rowNumber, cells }); } return rows; }
function attribute(value, name) { return value.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || ""; }
function columnNumber(reference) { const letters = reference.match(/^[A-Z]+/)?.[0] || ""; return [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0); }
function decodeXml(value) { return value.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16))).replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10))).replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); }

main().catch((error) => { console.error(error instanceof Error ? error.stack || error.message : error); process.exit(1); });
