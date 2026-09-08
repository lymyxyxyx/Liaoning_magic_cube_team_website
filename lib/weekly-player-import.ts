import yauzl from "yauzl";
import { Readable } from "node:stream";
import { getWeeklyAgeGroup } from "@/lib/weekly-age-groups";
import type { WeeklyLibraryGender } from "@/lib/weekly-player-library";

const expectedHeaders = ["姓名", "性别", "出生日期"] as const;
const maxZipEntryBytes = 2 * 1024 * 1024;

type ZipEntry = { fileName: string; uncompressedSize: number };
type ZipFileLike = {
  openReadStream(entry: ZipEntry, callback: (error: Error | null, stream?: Readable) => void): void;
};

export type WeeklyImportPlayerCandidate = {
  id: string;
  name: string;
  wcaId: string;
  gender: WeeklyLibraryGender;
  birthDate: string;
  province: string;
  city: string;
  status: "active" | "inactive";
};

export type WeeklyPlayerImportFieldConflict = "gender" | "birthDate";

export type WeeklyPlayerImportMatch = {
  type: "new" | "player_id" | "wca_id" | "exact_name" | "ambiguous_name" | "similar_name";
  recommendedPlayerId?: string;
  candidates: WeeklyImportPlayerCandidate[];
  fieldConflicts: WeeklyPlayerImportFieldConflict[];
};

export type WeeklyPlayerImportPreviewRow = {
  rowNumber: number;
  name: string;
  gender: WeeklyLibraryGender;
  birthDate: string;
  ageGroup: string;
  warnings: string[];
  errors: string[];
  match: WeeklyPlayerImportMatch;
};

export type WeeklyPlayerImportPreview = {
  parser: "liaoning-player-library-v1";
  sheetName: string;
  rawRowCount: number;
  validRowCount: number;
  warningCount: number;
  errorCount: number;
  genderUnknownCount: number;
  invalidBirthDateCount: number;
  exactNameMatchCount: number;
  newPlayerCount: number;
  ambiguousMatchCount: number;
  updateCount: number;
  rows: WeeklyPlayerImportPreviewRow[];
};

export async function parseLiaoningPlayerLibraryWorkbook(buffer: Buffer, players: WeeklyImportPlayerCandidate[]): Promise<WeeklyPlayerImportPreview> {
  const entries = await readZipEntries(buffer, new Set(["xl/sharedStrings.xml", "xl/styles.xml", "xl/worksheets/sheet1.xml"]));
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml") || "");
  const dateStyles = parseDateStyles(entries.get("xl/styles.xml") || "");
  const sheetXml = entries.get("xl/worksheets/sheet1.xml");
  if (!sheetXml) throw new Error("未找到 Sheet1，当前只支持长期卡学员信息表的固定格式");

  const sheetRows = parseSheetRows(sheetXml, sharedStrings, dateStyles);
  const header = sheetRows[0];
  const headerColumns = new Map(header.cells.map((cell) => [String(cell.value || "").trim(), cell.column]));
  for (const name of expectedHeaders) {
    if (!headerColumns.has(name)) throw new Error(`Sheet1 缺少“${name}”列，不能按长期卡学员表导入`);
  }

  const byId = new Map(players.map((player) => [player.id, player]));
  const byWcaId = groupBy(players.filter((player) => player.wcaId), (player) => player.wcaId.toUpperCase());
  const byName = groupBy(players, (player) => normalizeName(player.name));

  const rows: WeeklyPlayerImportPreviewRow[] = [];
  let genderUnknownCount = 0;
  let invalidBirthDateCount = 0;

  for (const row of sheetRows.slice(1)) {
    const valueByColumn = new Map(row.cells.map((cell) => [cell.column, cell.value]));
    const name = normalizeName(valueByColumn.get(headerColumns.get("姓名")!));
    const gender = normalizeGender(valueByColumn.get(headerColumns.get("性别")!));
    const birth = normalizeBirthDate(valueByColumn.get(headerColumns.get("出生日期")!));
    const warnings: string[] = [];
    const errors: string[] = [];
    if (!name) errors.push("姓名为空，无法导入");
    if (!gender) {
      genderUnknownCount += 1;
      warnings.push("性别未知，本次不会写入性别");
    }
    if (birth.invalid) {
      invalidBirthDateCount += 1;
      warnings.push("出生日期不是完整有效日期，本次不会写入生日");
    }

    const match = buildWeeklyPlayerImportMatch({ name, gender, birthDate: birth.value, playerId: "", wcaId: "" }, { byId, byWcaId, byName, players });
    rows.push({
      rowNumber: row.rowNumber,
      name,
      gender,
      birthDate: birth.value,
      ageGroup: getWeeklyAgeGroup(birth.value) || "",
      warnings,
      errors,
      match
    });
  }

  // A file may not create two independent profiles with the same normalized
  // name. Mark every participant in the duplicate group for review.
  for (const duplicates of groupBy(rows.filter((row) => row.name), (row) => normalizeName(row.name)).values()) {
    if (duplicates.length > 1) {
      for (const row of duplicates) row.errors.push("Excel 文件内存在标准化姓名重复，必须人工处理");
    }
  }

  const validRows = rows.filter((row) => row.errors.length === 0);
  const exactNameMatchCount = validRows.filter((row) => row.match.type === "exact_name").length;
  const ambiguousMatchCount = validRows.filter((row) => row.match.type === "ambiguous_name" || row.match.type === "similar_name").length;
  const newPlayerCount = validRows.filter((row) => row.match.type === "new" || row.match.type === "similar_name").length;
  const updateCount = validRows.filter((row) => row.match.recommendedPlayerId && willUpdate(row)).length;

  return {
    parser: "liaoning-player-library-v1",
    sheetName: "Sheet1",
    rawRowCount: rows.length,
    validRowCount: validRows.length,
    warningCount: rows.reduce((total, row) => total + row.warnings.length, 0),
    errorCount: rows.reduce((total, row) => total + row.errors.length, 0),
    genderUnknownCount,
    invalidBirthDateCount,
    exactNameMatchCount,
    newPlayerCount,
    ambiguousMatchCount,
    updateCount,
    rows
  };
}

// Shared identity precedence for the player library and weekly result imports.
export function buildWeeklyPlayerImportMatch(
  input: { name: string; gender: WeeklyLibraryGender; birthDate: string; playerId: string; wcaId: string },
  index: {
    byId: Map<string, WeeklyImportPlayerCandidate>;
    byWcaId: Map<string, WeeklyImportPlayerCandidate[]>;
    byName: Map<string, WeeklyImportPlayerCandidate[]>;
    players: WeeklyImportPlayerCandidate[];
  }
): WeeklyPlayerImportMatch {
  let type: WeeklyPlayerImportMatch["type"] = "new";
  let candidates: WeeklyImportPlayerCandidate[] = [];
  let recommendedPlayerId = "";

  if (input.playerId && index.byId.has(input.playerId)) {
    type = "player_id";
    candidates = [index.byId.get(input.playerId)!];
    recommendedPlayerId = input.playerId;
  } else if (input.wcaId) {
    candidates = index.byWcaId.get(input.wcaId.toUpperCase()) || [];
    if (candidates.length === 1) {
      type = "wca_id";
      recommendedPlayerId = candidates[0].id;
    } else if (candidates.length > 1) {
      type = "ambiguous_name";
    }
  }

  if (!recommendedPlayerId && !candidates.length && input.name) {
    candidates = index.byName.get(normalizeName(input.name)) || [];
    if (candidates.length === 1) {
      type = "exact_name";
      recommendedPlayerId = candidates[0].id;
    } else if (candidates.length > 1) {
      type = "ambiguous_name";
    } else {
      const similar = index.players
        .filter((player) => isSimilarName(input.name, player.name))
        .slice(0, 5);
      if (similar.length > 0) {
        type = "similar_name";
        candidates = similar;
      }
    }
  }

  const selected = recommendedPlayerId ? candidates.find((candidate) => candidate.id === recommendedPlayerId) : undefined;
  const fieldConflicts: WeeklyPlayerImportFieldConflict[] = [];
  if (selected) {
    if (input.gender && selected.gender && input.gender !== selected.gender) fieldConflicts.push("gender");
    if (input.birthDate && selected.birthDate && input.birthDate !== selected.birthDate) fieldConflicts.push("birthDate");
  }
  return { type, recommendedPlayerId: recommendedPlayerId || undefined, candidates, fieldConflicts };
}

function willUpdate(row: WeeklyPlayerImportPreviewRow) {
  const player = row.match.candidates.find((candidate) => candidate.id === row.match.recommendedPlayerId);
  return Boolean(
    player && (
      row.match.fieldConflicts.length > 0 ||
      (!player.gender && row.gender) ||
      (!player.birthDate && row.birthDate)
    )
  );
}

function normalizeGender(value: unknown): WeeklyLibraryGender {
  const gender = String(value ?? "").trim();
  return gender === "男" || gender === "女" ? gender : "";
}

function normalizeBirthDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || text === "未知") return { value: "", invalid: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { value: "", invalid: true };
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const currentYear = new Date().getUTCFullYear();
  if (year < 1900 || year > currentYear || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { value: "", invalid: true };
  }
  return { value: text, invalid: false };
}

function normalizeName(value: unknown) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, "").trim();
}

function isSimilarName(left: string, right: string) {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b || a === b || Math.abs(a.length - b.length) > 1) return false;
  return levenshteinDistance(a, b) <= 1;
}

function levenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[right.length];
}

async function readZipEntries(buffer: Buffer, wanted: Set<string>) {
  return new Promise<Map<string, string>>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zipFile) => {
      if (error || !zipFile) {
        reject(error || new Error("无法读取 Excel 文件"));
        return;
      }
      const entries = new Map<string, string>();
      zipFile.readEntry();
      zipFile.on("entry", async (entry: ZipEntry) => {
        try {
          if (!wanted.has(entry.fileName)) {
            zipFile.readEntry();
            return;
          }
          if (entry.uncompressedSize > maxZipEntryBytes) throw new Error("Excel 工作表过大");
          const source = await openZipEntry(zipFile, entry);
          entries.set(entry.fileName, await streamToString(source));
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

function openZipEntry(zipFile: ZipFileLike, entry: ZipEntry) {
  return new Promise<Readable>((resolve, reject) => {
    zipFile.openReadStream(entry, (error: Error | null, stream?: Readable) => {
      if (error || !stream) reject(error || new Error("无法读取 Excel 工作表"));
      else resolve(stream);
    });
  });
}

async function streamToString(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function parseSharedStrings(xml: string) {
  const values: string[] = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    values.push(Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map((part) => decodeXml(part[1])).join(""));
  }
  return values;
}

function parseSheetRows(xml: string, sharedStrings: string[], dateStyles: Set<number>) {
  const rows: { rowNumber: number; cells: { column: number; value: string }[] }[] = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(readXmlAttribute(rowMatch[1], "r"));
    if (!Number.isInteger(rowNumber)) continue;
    const cells: { column: number; value: string }[] = [];
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const reference = readXmlAttribute(cellMatch[1], "r");
      const type = readXmlAttribute(cellMatch[1], "t");
      const style = Number(readXmlAttribute(cellMatch[1], "s"));
      const column = columnNumber(reference);
      if (!column) continue;
      const cellXml = cellMatch[2] || "";
      const valueMatch = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
      const inlineMatch = cellXml.match(/<is\b[^>]*>([\s\S]*?)<\/is>/);
      const rawValue = valueMatch ? decodeXml(valueMatch[1]) : inlineMatch ? Array.from(inlineMatch[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map((part) => decodeXml(part[1])).join("") : "";
      const value = type === "s"
        ? sharedStrings[Number(rawValue)] || ""
        : dateStyles.has(style) && /^\d+(?:\.\d+)?$/.test(rawValue)
          ? excelSerialDateToIso(Number(rawValue))
          : rawValue;
      cells.push({ column, value });
    }
    rows.push({ rowNumber, cells });
  }
  return rows;
}

function parseDateStyles(xml: string) {
  const dateStyles = new Set<number>();
  const cellXfs = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] || "";
  let style = 0;
  for (const match of cellXfs.matchAll(/<xf\b([^>]*)>/g)) {
    const numFmtId = Number(readXmlAttribute(match[1], "numFmtId"));
    if (isDateFormatId(numFmtId)) dateStyles.add(style);
    style += 1;
  }
  return dateStyles;
}

function isDateFormatId(value: number) {
  return Number.isInteger(value) && ((value >= 14 && value <= 22) || (value >= 27 && value <= 36) || value === 45 || value === 47 || value === 50 || value === 51 || value === 52 || value === 53 || value === 54 || value === 55 || value === 56 || value === 57 || value === 58);
}

function excelSerialDateToIso(serial: number) {
  // Excel's 1900 system includes the historical fake 1900-02-29 day.
  const milliseconds = Math.round((serial - 25569) * 86_400_000);
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function readXmlAttribute(value: string, name: string) {
  return value.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || "";
}

function columnNumber(reference: string) {
  const letters = reference.match(/^[A-Z]+/)?.[0];
  if (!letters) return 0;
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    const group = groups.get(groupKey) || [];
    group.push(item);
    groups.set(groupKey, group);
  }
  return groups;
}
