import yauzl from "yauzl";
import { Readable } from "node:stream";

export const weeklyResultInfoHeaders = ["meet_slug", "week_number", "title", "start_date", "end_date"] as const;
export const weeklyResultHeaders = ["event_code", "player_id", "wca_id", "player_name", "attempt_1", "attempt_2", "attempt_3", "attempt_4", "attempt_5", "notes"] as const;

export type WeeklyResultTemplateMeet = {
  slug: string;
  weekNumber: number;
  title: string;
  startDate: string;
  endDate: string;
};

export type ParsedWeeklyResultsWorkbook = {
  parser: "weekly-results-template-v1" | "weekly-results-legacy-weekly-v1";
  metadata: Record<(typeof weeklyResultInfoHeaders)[number], string>;
  rows: Array<{ sourceRow: number; values: Record<(typeof weeklyResultHeaders)[number], string> }>;
};

export type WeeklyResultsExportRow = {
  eventCode: string;
  format: string;
  rank: number;
  playerId: string;
  wcaId: string;
  playerName: string;
  gender: string;
  ageGroup: string;
  level: string;
  grade: string;
  average: string;
  best: string;
  personalBest: string;
  pbRefreshed: boolean;
  attempts: string[];
};

const maxZipEntryBytes = 2 * 1024 * 1024;
type ZipEntry = { fileName: string; uncompressedSize: number };
type ZipFileLike = { openReadStream(entry: ZipEntry, callback: (error: Error | null, stream?: Readable) => void): void; readEntry(): void; close(): void; on(event: string, callback: (...args: never[]) => void): void };

export function createWeeklyResultsTemplate(meet: WeeklyResultTemplateMeet) {
  const info = [meet.slug, String(meet.weekNumber), meet.title, meet.startDate, meet.endDate];
  return createWorkbook([
    { name: "比赛信息", rows: [weeklyResultInfoHeaders, info] },
    { name: "成绩", rows: [weeklyResultHeaders] }
  ]);
}

export function createWeeklyResultsExport(meet: WeeklyResultTemplateMeet, rows: WeeklyResultsExportRow[]) {
  const headers = ["项目", "赛制", "排名", "选手 ID", "WCA ID", "姓名", "性别", "年龄组", "段位", "等级", "平均", "本周最快", "个人 PB", "刷新 PB", "T1", "T2", "T3", "T4", "T5"];
  const values = rows.map((row) => [
    row.eventCode, row.format, String(row.rank), row.playerId, row.wcaId, row.playerName, row.gender,
    row.ageGroup, row.level, row.grade, row.average, row.best, row.personalBest, row.pbRefreshed ? "是" : "否",
    ...Array.from({ length: 5 }, (_, index) => row.attempts[index] || "")
  ]);
  return createWorkbook([
    { name: "比赛信息", rows: [weeklyResultInfoHeaders, [meet.slug, String(meet.weekNumber), meet.title, meet.startDate, meet.endDate]] },
    { name: "成绩导出", rows: [headers, ...values] }
  ]);
}

function createWorkbook(sheets: Array<{ name: string; rows: readonly (readonly string[])[] }>) {
  const sheetOverrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const sheetNodes = sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const relationships = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const entries: Array<[string, string]> = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetNodes}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`],
    ...sheets.map((sheet, index) => [`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(sheet.rows)] as [string, string])
  ];
  return createStoredZip(entries.map(([name, content]) => ({ name, data: Buffer.from(content, "utf8") })));
}

export async function parseWeeklyResultsWorkbook(buffer: Buffer): Promise<ParsedWeeklyResultsWorkbook> {
  const workbookEntries = await readZipEntries(buffer, new Set(["xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/sharedStrings.xml", "xl/styles.xml"]));
  const sheets = parseWorkbookSheets(workbookEntries.get("xl/workbook.xml") || "", workbookEntries.get("xl/_rels/workbook.xml.rels") || "");
  const standardTemplate = sheets.length === 2 && sheets[0]?.name === "比赛信息" && sheets[1]?.name === "成绩";
  const legacySheets = sheets.filter((sheet) => legacySheetSpecs.some((spec) => spec.sheetName === sheet.name));
  const sourceSheets = standardTemplate ? sheets : legacySheets;
  const entries = await readZipEntries(buffer, new Set(["xl/sharedStrings.xml", "xl/styles.xml", ...sourceSheets.map((sheet) => sheet.target)]));
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml") || "");

  if (!standardTemplate && legacySheets.length === 0) throw new Error("请上传标准成绩模板，或包含三阶、二阶、金字塔、枫叶、镜面、个人全能成绩页的周赛统计表");
  if (!standardTemplate) return parseLegacyWeeklyWorkbook(legacySheets, entries, sharedStrings);

  const dateStyles = parseDateStyles(entries.get("xl/styles.xml") || "");
  const infoRows = parseSheetRows(entries.get(sheets[0].target) || "", sharedStrings, dateStyles);
  const resultRows = parseSheetRows(entries.get(sheets[1].target) || "", sharedStrings, dateStyles);
  const infoHeader = cellsToValues(infoRows[0]);
  const infoValues = cellsToValues(infoRows[1]);
  assertExactHeaders(infoHeader, weeklyResultInfoHeaders, "比赛信息");
  assertExactHeaders(cellsToValues(resultRows[0]), weeklyResultHeaders, "成绩");
  if (!infoRows[1]) throw new Error("比赛信息缺少当前周赛数据");

  const metadata = Object.fromEntries(weeklyResultInfoHeaders.map((header, index) => [header, infoValues[index] || ""])) as ParsedWeeklyResultsWorkbook["metadata"];
  const rows = resultRows.slice(1).map((row) => ({
    sourceRow: row.rowNumber,
    values: Object.fromEntries(weeklyResultHeaders.map((header, index) => [header, cellsToValues(row)[index] || ""])) as ParsedWeeklyResultsWorkbook["rows"][number]["values"]
  })).filter((row) => weeklyResultHeaders.some((header) => row.values[header].trim()));
  return { parser: "weekly-results-template-v1", metadata, rows };
}

const legacySheetSpecs = [
  { sheetName: "三阶", eventCode: "333", nameColumn: 2, attemptColumn: 5, attemptCount: 5 },
  { sheetName: "二阶", eventCode: "222", nameColumn: 2, attemptColumn: 4, attemptCount: 5 },
  { sheetName: "金字塔", eventCode: "pyram", nameColumn: 2, attemptColumn: 4, attemptCount: 5 },
  { sheetName: "枫叶", eventCode: "maple", nameColumn: 2, attemptColumn: 4, attemptCount: 5 },
  { sheetName: "镜面", eventCode: "mirror", nameColumn: 2, attemptColumn: 4, attemptCount: 5 },
  { sheetName: "个人全能", eventCode: "individual", nameColumn: 2, attemptColumn: 4, attemptCount: 1 }
] as const;

function parseLegacyWeeklyWorkbook(
  sheets: Array<{ name: string; target: string }>,
  entries: Map<string, string>,
  sharedStrings: string[]
): ParsedWeeklyResultsWorkbook {
  const rows: ParsedWeeklyResultsWorkbook["rows"] = [];
  let detectedWeekNumber = "";
  for (const spec of legacySheetSpecs) {
    const sheet = sheets.find((item) => item.name === spec.sheetName);
    if (!sheet) continue;
    // Keep raw numeric values here. Some teacher workbooks use a time-like
    // number format for long results; interpreting that style as a calendar
    // date would corrupt a result such as 144.30 seconds.
    const sheetRows = parseSheetRows(entries.get(sheet.target) || "", sharedStrings, new Set());
    const title = cellsToValues(sheetRows[0])[0] || "";
    detectedWeekNumber ||= title.match(/第\s*(\d+)\s*周/)?.[1] || "";
    for (const source of sheetRows.filter((row) => row.rowNumber >= 3)) {
      const values = cellsToValues(source);
      const playerName = values[spec.nameColumn - 1] || "";
      const attempts = Array.from({ length: spec.attemptCount }, (_, index) => values[spec.attemptColumn - 1 + index] || "");
      if (!playerName.trim() || !attempts.some((value) => value.trim())) continue;
      rows.push({
        sourceRow: rows.length + 1,
        values: {
          event_code: spec.eventCode,
          player_id: "",
          wca_id: "",
          player_name: playerName.trim(),
          attempt_1: attempts[0] || "",
          attempt_2: attempts[1] || "",
          attempt_3: attempts[2] || "",
          attempt_4: attempts[3] || "",
          attempt_5: attempts[4] || "",
          notes: `来源：${spec.sheetName}第${source.rowNumber}行`
        }
      });
    }
  }
  if (!rows.length) throw new Error("未在周赛统计表中找到可导入的成绩行");
  return {
    parser: "weekly-results-legacy-weekly-v1",
    metadata: { meet_slug: "", week_number: detectedWeekNumber, title: "", start_date: "", end_date: "" },
    rows
  };
}

function parseWorkbookSheets(workbook: string, relationshipXml: string) {
  const targetByRelationship = new Map(Array.from(relationshipXml.matchAll(/<Relationship\b([^>]*)\/>/g)).map((match) => [readXmlAttribute(match[1], "Id"), `xl/${readXmlAttribute(match[1], "Target").replace(/^\/+/, "")}`]));
  return Array.from(workbook.matchAll(/<sheet\b([^>]*)\/>/g)).map((match) => {
    const relationshipId = readXmlAttribute(match[1], "r:id");
    return { name: readXmlAttribute(match[1], "name"), target: targetByRelationship.get(relationshipId) || "" };
  }).filter((sheet) => Boolean(sheet.target));
}

function assertExactHeaders(actual: string[], expected: readonly string[], sheetName: string) {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) throw new Error(`${sheetName} 工作表列名或列顺序不符合标准模板`);
}

function worksheetXml(rows: readonly (readonly string[])[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => `<c r="${columnName(columnIndex + 1)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
}

function columnName(column: number) { let value = column; let name = ""; while (value > 0) { const remainder = (value - 1) % 26; name = String.fromCharCode(65 + remainder) + name; value = Math.floor((value - 1) / 26); } return name; }
function escapeXml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

async function readZipEntries(buffer: Buffer, wanted: Set<string>) {
  return new Promise<Map<string, string>>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zipFile) => {
      if (error || !zipFile) { reject(error || new Error("无法读取 Excel 文件")); return; }
      const file = zipFile as unknown as ZipFileLike;
      const entries = new Map<string, string>(); file.readEntry();
      file.on("entry", async (entry: ZipEntry) => {
        try { if (!wanted.has(entry.fileName)) { file.readEntry(); return; } if (entry.uncompressedSize > maxZipEntryBytes) throw new Error("Excel 工作表过大"); const stream = await openZipEntry(file, entry); entries.set(entry.fileName, await streamToString(stream)); file.readEntry(); } catch (entryError) { file.close(); reject(entryError); }
      });
      file.on("end", () => resolve(entries)); file.on("error", reject);
    });
  });
}
function openZipEntry(zipFile: ZipFileLike, entry: ZipEntry) { return new Promise<Readable>((resolve, reject) => zipFile.openReadStream(entry, (error, stream) => error || !stream ? reject(error || new Error("无法读取 Excel 工作表")) : resolve(stream))); }
async function streamToString(stream: Readable) { const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return Buffer.concat(chunks).toString("utf8"); }
function parseSharedStrings(xml: string) { return Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)).map((match) => Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map((part) => decodeXml(part[1])).join("")); }
function parseDateStyles(xml: string) { const styles = new Set<number>(); const cellXfs = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] || ""; let style = 0; for (const match of cellXfs.matchAll(/<xf\b([^>]*)>/g)) { const id = Number(readXmlAttribute(match[1], "numFmtId")); if ((id >= 14 && id <= 22) || (id >= 27 && id <= 36) || [45, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58].includes(id)) styles.add(style); style += 1; } return styles; }
function parseSheetRows(xml: string, sharedStrings: string[], dateStyles: Set<number>) { const rows: Array<{ rowNumber: number; cells: Array<{ column: number; value: string }> }> = []; for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) { const rowNumber = Number(readXmlAttribute(rowMatch[1], "r")); if (!Number.isInteger(rowNumber)) continue; const cells: Array<{ column: number; value: string }> = []; for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) { const reference = readXmlAttribute(cellMatch[1], "r"); const type = readXmlAttribute(cellMatch[1], "t"); const style = Number(readXmlAttribute(cellMatch[1], "s")); const column = columnNumber(reference); if (!column) continue; const cellXml = cellMatch[2] || ""; const raw = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1]; const inline = cellXml.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)?.[1]; const value = raw ? decodeXml(raw) : inline ? Array.from(inline.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map((part) => decodeXml(part[1])).join("") : ""; cells.push({ column, value: type === "s" ? sharedStrings[Number(value)] || "" : dateStyles.has(style) && /^\d+(?:\.\d+)?$/.test(value) ? excelSerialDateToIso(Number(value)) : value }); } rows.push({ rowNumber, cells }); } return rows; }
function cellsToValues(row: { cells: Array<{ column: number; value: string }> } | undefined) { if (!row) return []; const byColumn = new Map(row.cells.map((cell) => [cell.column, cell.value.trim()])); const max = Math.max(0, ...byColumn.keys()); return Array.from({ length: max }, (_, index) => byColumn.get(index + 1) || ""); }
function columnNumber(reference: string) { const letters = reference.match(/^[A-Z]+/)?.[0]; return letters ? [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) : 0; }
function excelSerialDateToIso(serial: number) { const date = new Date(Math.round((serial - 25569) * 86_400_000)); return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10); }
function readXmlAttribute(value: string, name: string) { return value.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || ""; }
function decodeXml(value: string) { return value.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16))).replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10))).replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); }

function createStoredZip(entries: Array<{ name: string; data: Buffer }>) { const local: Buffer[] = []; const central: Buffer[] = []; let offset = 0; for (const entry of entries) { const name = Buffer.from(entry.name); const crc = crc32(entry.data); const localHeader = Buffer.alloc(30); localHeader.writeUInt32LE(0x04034b50, 0); localHeader.writeUInt16LE(20, 4); localHeader.writeUInt16LE(0, 6); localHeader.writeUInt16LE(0, 8); localHeader.writeUInt16LE(0, 10); localHeader.writeUInt16LE(0, 12); localHeader.writeUInt32LE(crc, 14); localHeader.writeUInt32LE(entry.data.length, 18); localHeader.writeUInt32LE(entry.data.length, 22); localHeader.writeUInt16LE(name.length, 26); localHeader.writeUInt16LE(0, 28); local.push(localHeader, name, entry.data); const centralHeader = Buffer.alloc(46); centralHeader.writeUInt32LE(0x02014b50, 0); centralHeader.writeUInt16LE(20, 4); centralHeader.writeUInt16LE(20, 6); centralHeader.writeUInt16LE(0, 8); centralHeader.writeUInt16LE(0, 10); centralHeader.writeUInt16LE(0, 12); centralHeader.writeUInt16LE(0, 14); centralHeader.writeUInt32LE(crc, 16); centralHeader.writeUInt32LE(entry.data.length, 20); centralHeader.writeUInt32LE(entry.data.length, 24); centralHeader.writeUInt16LE(name.length, 28); centralHeader.writeUInt16LE(0, 30); centralHeader.writeUInt16LE(0, 32); centralHeader.writeUInt16LE(0, 34); centralHeader.writeUInt16LE(0, 36); centralHeader.writeUInt32LE(0, 38); centralHeader.writeUInt32LE(offset, 42); central.push(centralHeader, name); offset += localHeader.length + name.length + entry.data.length; } const centralBuffer = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralBuffer.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20); return Buffer.concat([...local, centralBuffer, end]); }
function crc32(data: Buffer) { let crc = 0xffffffff; for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
