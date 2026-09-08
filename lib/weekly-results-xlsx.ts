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
  metadata: Record<(typeof weeklyResultInfoHeaders)[number], string>;
  rows: Array<{ sourceRow: number; values: Record<(typeof weeklyResultHeaders)[number], string> }>;
};

const maxZipEntryBytes = 2 * 1024 * 1024;
type ZipEntry = { fileName: string; uncompressedSize: number };
type ZipFileLike = { openReadStream(entry: ZipEntry, callback: (error: Error | null, stream?: Readable) => void): void; readEntry(): void; close(): void; on(event: string, callback: (...args: never[]) => void): void };

export function createWeeklyResultsTemplate(meet: WeeklyResultTemplateMeet) {
  const info = [meet.slug, String(meet.weekNumber), meet.title, meet.startDate, meet.endDate];
  const entries: Array<[string, string]> = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="比赛信息" sheetId="1" r:id="rId1"/><sheet name="成绩" sheetId="2" r:id="rId2"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`],
    ["xl/worksheets/sheet1.xml", worksheetXml([weeklyResultInfoHeaders, info])],
    ["xl/worksheets/sheet2.xml", worksheetXml([weeklyResultHeaders])]
  ];
  return createStoredZip(entries.map(([name, content]) => ({ name, data: Buffer.from(content, "utf8") })));
}

export async function parseWeeklyResultsWorkbook(buffer: Buffer): Promise<ParsedWeeklyResultsWorkbook> {
  const entries = await readZipEntries(buffer, new Set(["xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/sharedStrings.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]));
  const workbook = entries.get("xl/workbook.xml") || "";
  const relationshipXml = entries.get("xl/_rels/workbook.xml.rels") || "";
  const sheets = Array.from(workbook.matchAll(/<sheet\b([^>]*)\/>/g)).map((match) => ({ name: readXmlAttribute(match[1], "name"), relationshipId: readXmlAttribute(match[1], "r:id") }));
  if (sheets.length !== 2 || sheets[0]?.name !== "比赛信息" || sheets[1]?.name !== "成绩") throw new Error("只支持包含“比赛信息”和“成绩”两个固定工作表的标准模板");
  const targetByRelationship = new Map(Array.from(relationshipXml.matchAll(/<Relationship\b([^>]*)\/>/g)).map((match) => [readXmlAttribute(match[1], "Id"), `xl/${readXmlAttribute(match[1], "Target").replace(/^\/+/, "")}`]));
  if (targetByRelationship.get(sheets[0].relationshipId) !== "xl/worksheets/sheet1.xml" || targetByRelationship.get(sheets[1].relationshipId) !== "xl/worksheets/sheet2.xml") throw new Error("标准模板工作表结构不正确");

  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml") || "");
  const dateStyles = parseDateStyles(entries.get("xl/styles.xml") || "");
  const infoRows = parseSheetRows(entries.get("xl/worksheets/sheet1.xml") || "", sharedStrings, dateStyles);
  const resultRows = parseSheetRows(entries.get("xl/worksheets/sheet2.xml") || "", sharedStrings, dateStyles);
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
  return { metadata, rows };
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
