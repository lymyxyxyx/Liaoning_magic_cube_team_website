import yauzl, { type Entry, type ZipFile } from "yauzl";

export type BigStackSpreadsheetRow = {
  rowNumber: number;
  name: string;
  count: number;
  playerId?: string;
  wcaId?: string;
  achievedAt?: string;
  note?: string;
};

export type BigStackSpreadsheetResult = {
  rows: BigStackSpreadsheetRow[];
  errors: string[];
  warnings: string[];
};

type SheetCell = string | number | null;

const headerAliases = {
  name: new Set(["姓名", "选手姓名", "名字", "name"]),
  count: new Set(["最高记录", "最高纪录", "数量", "成绩", "best", "count"]),
  playerId: new Set(["周赛选手id", "选手id", "playerid", "player_id"]),
  wcaId: new Set(["wcaid", "wca_id"]),
  achievedAt: new Set(["达成日期", "日期", "achievedat", "achieved_at"]),
  note: new Set(["备注", "说明", "note"])
};

export async function parseBigStackWorkbook(buffer: Buffer): Promise<BigStackSpreadsheetResult> {
  if (buffer.length === 0) return { rows: [], errors: ["Excel 文件为空"], warnings: [] };
  if (buffer.length > 8 * 1024 * 1024) return { rows: [], errors: ["Excel 文件不能超过 8MB"], warnings: [] };

  const entries = await readRelevantEntries(buffer);
  const worksheetEntry = [...entries.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort()[0];
  if (!worksheetEntry) return { rows: [], errors: ["Excel 中没有可读取的工作表"], warnings: [] };

  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml")?.toString("utf8") || "");
  const sheetRows = parseWorksheet(entries.get(worksheetEntry)?.toString("utf8") || "", sharedStrings);
  const header = findHeader(sheetRows);
  if (!header) {
    return { rows: [], errors: ["找不到表头，请至少包含“姓名”和“最高记录”两列"], warnings: [] };
  }

  const rows: BigStackSpreadsheetRow[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const sheetRow of sheetRows.filter((row) => row.rowNumber > header.rowNumber)) {
    const name = cellText(sheetRow.cells[header.columns.name]).trim();
    const rawCount = sheetRow.cells[header.columns.count];
    const hasAnyValue = sheetRow.cells.some((value) => cellText(value).trim());
    if (!hasAnyValue) continue;
    if (!name) {
      errors.push(`第 ${sheetRow.rowNumber} 行缺少姓名`);
      continue;
    }

    const count = typeof rawCount === "number" ? rawCount : Number(cellText(rawCount).trim());
    if (!Number.isInteger(count) || count < 0) {
      errors.push(`第 ${sheetRow.rowNumber} 行“${name}”的最高记录必须是非负整数`);
      continue;
    }

    const playerId = optionalCell(sheetRow.cells[header.columns.playerId ?? -1]);
    const wcaId = optionalCell(sheetRow.cells[header.columns.wcaId ?? -1]).toUpperCase();
    const achievedAt = normalizeDateCell(sheetRow.cells[header.columns.achievedAt ?? -1]);
    const note = optionalCell(sheetRow.cells[header.columns.note ?? -1]);
    if (wcaId && !/^\d{4}[A-Z]{4}\d{2}$/.test(wcaId)) warnings.push(`第 ${sheetRow.rowNumber} 行“${name}”的 WCA ID 格式需要人工确认`);
    rows.push({ rowNumber: sheetRow.rowNumber, name, count, playerId: playerId || undefined, wcaId: wcaId || undefined, achievedAt: achievedAt || undefined, note: note || undefined });
  }

  if (rows.length === 0 && errors.length === 0) errors.push("Excel 中没有成绩记录");
  const duplicateKeys = findDuplicateIdentityKeys(rows);
  for (const duplicate of duplicateKeys) errors.push(`重复记录：${duplicate}`);
  return { rows, errors, warnings };
}

async function readRelevantEntries(buffer: Buffer) {
  return new Promise<Map<string, Buffer>>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(new Error("无法打开 Excel 文件"));
        return;
      }
      const entries = new Map<string, Buffer>();
      const wanted = (name: string) => name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(name);
      zipFile.on("entry", (entry) => readEntry(zipFile, entry, wanted(entry.fileName), entries, reject));
      zipFile.on("end", () => resolve(entries));
      zipFile.on("error", reject);
      zipFile.readEntry();
    });
  });
}

function readEntry(zipFile: ZipFile, entry: Entry, wanted: boolean, entries: Map<string, Buffer>, reject: (error: Error) => void) {
  if (!wanted) {
    zipFile.readEntry();
    return;
  }
  zipFile.openReadStream(entry, (error, stream) => {
    if (error || !stream) {
      reject(error || new Error(`无法读取 ${entry.fileName}`));
      return;
    }
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => {
      entries.set(entry.fileName, Buffer.concat(chunks));
      zipFile.readEntry();
    });
    stream.on("error", reject);
  });
}

function parseSharedStrings(xml: string) {
  if (!xml) return [];
  return [...xml.matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)].map((match) =>
    [...match[1].matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((part) => decodeXml(part[1])).join("")
  );
}

function parseWorksheet(xml: string, sharedStrings: string[]) {
  const rows: Array<{ rowNumber: number; cells: SheetCell[] }> = [];
  for (const rowMatch of xml.matchAll(/<(?:\w+:)?row\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
    const rowNumber = Number(attribute(rowMatch[1], "r")) || rows.length + 1;
    const cells: SheetCell[] = [];
    for (const cellMatch of rowMatch[2].matchAll(/<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/g)) {
      const reference = attribute(cellMatch[1], "r");
      const columnIndex = reference ? columnToIndex(reference.replace(/\d+/g, "")) : cells.length;
      const type = attribute(cellMatch[1], "t");
      const body = cellMatch[2];
      const valueMatch = body.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/);
      const inlineText = [...body.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((part) => decodeXml(part[1])).join("");
      const raw = valueMatch ? decodeXml(valueMatch[1]) : inlineText;
      if (type === "s") cells[columnIndex] = sharedStrings[Number(raw)] ?? "";
      else if (type === "inlineStr" || type === "str") cells[columnIndex] = raw;
      else if (raw !== "" && Number.isFinite(Number(raw))) cells[columnIndex] = Number(raw);
      else cells[columnIndex] = raw || null;
    }
    rows.push({ rowNumber, cells });
  }
  return rows;
}

function findHeader(rows: Array<{ rowNumber: number; cells: SheetCell[] }>) {
  for (const row of rows.slice(0, 15)) {
    const normalized = row.cells.map((cell) => normalizeHeader(cellText(cell)));
    const name = normalized.findIndex((value) => headerAliases.name.has(value));
    const count = normalized.findIndex((value) => headerAliases.count.has(value));
    if (name < 0 || count < 0) continue;
    const optionalColumn = (aliases: Set<string>) => {
      const index = normalized.findIndex((value) => aliases.has(value));
      return index >= 0 ? index : undefined;
    };
    return {
      rowNumber: row.rowNumber,
      columns: {
        name,
        count,
        playerId: optionalColumn(headerAliases.playerId),
        wcaId: optionalColumn(headerAliases.wcaId),
        achievedAt: optionalColumn(headerAliases.achievedAt),
        note: optionalColumn(headerAliases.note)
      }
    };
  }
  return null;
}

function findDuplicateIdentityKeys(rows: BigStackSpreadsheetRow[]) {
  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  for (const row of rows) {
    const key = row.playerId ? `周赛选手ID ${row.playerId}` : row.wcaId ? `WCA ID ${row.wcaId}` : `姓名 ${row.name}`;
    const existing = seen.get(key);
    if (existing) duplicates.push(`${key}（第 ${existing}、${row.rowNumber} 行）`);
    else seen.set(key, row.rowNumber);
  }
  return duplicates;
}

function normalizeDateCell(value: SheetCell) {
  if (typeof value === "number" && value > 0) {
    const timestamp = Date.UTC(1899, 11, 30) + Math.round(value * 86_400_000);
    return new Date(timestamp).toISOString().slice(0, 10);
  }
  const text = cellText(value).trim();
  if (!text) return "";
  const match = text.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
  if (!match) return text;
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function optionalCell(value: SheetCell) {
  return cellText(value).trim();
}

function cellText(value: SheetCell | undefined) {
  return value == null ? "" : String(value);
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "");
}

function columnToIndex(column: string) {
  return [...column.toUpperCase()].reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0) - 1;
}

function attribute(source: string, name: string) {
  return source.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1] || "";
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}
