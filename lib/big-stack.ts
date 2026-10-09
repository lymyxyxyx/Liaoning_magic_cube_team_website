import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { getPostgresPool } from "@/lib/postgres";
import type { BigStackSpreadsheetRow } from "@/lib/big-stack-xlsx";

export const BIG_STACK_EVENTS = [
  { id: "333", name: "三阶" },
  { id: "222", name: "二阶" },
  { id: "pyram", name: "金字塔" },
  { id: "maple", name: "枫叶" },
  { id: "mirror", name: "镜面" }
] as const;

export type BigStackEventId = typeof BIG_STACK_EVENTS[number]["id"];

export type BigStackRecord = {
  id: string;
  name: string;
  eventId: BigStackEventId;
  solveCount: number;
  playerId?: string;
  wcaId?: string;
  achievedAt?: string;
  meetId: string | null;
  meetTitle: string;
  sourceLabel: string;
  note: string;
  rank: number;
  updatedAt: string;
};

export type BigStackRevision = {
  id: number;
  recordId: string;
  action: string;
  reason: string;
  before?: BigStackRecord;
  after?: BigStackRecord;
  pointsAwarded: number;
  importBatchId?: string;
  createdAt: string;
};

export type BigStackImportMode = "baseline" | "merge";
export type BigStackImportAction = "replace" | "new" | "improved" | "unchanged" | "lower" | "ambiguous";
export type BigStackMatchMethod = "player_id" | "wca_id" | "exact_name" | "unmatched" | "ambiguous";

export type BigStackImportPreviewRow = BigStackSpreadsheetRow & {
  action: BigStackImportAction;
  matchMethod: BigStackMatchMethod;
  resolvedPlayerId?: string;
  resolvedWcaId?: string;
  currentCount?: number;
  existingRecordId?: string;
  message?: string;
};

export type BigStackImportPreview = {
  eventId: BigStackEventId;
  mode: BigStackImportMode;
  rows: BigStackImportPreviewRow[];
  errors: string[];
  warnings: string[];
  summary: {
    total: number;
    replace: number;
    inserted: number;
    improved: number;
    unchanged: number;
    lowerIgnored: number;
    unresolved: number;
    ambiguous: number;
  };
};

type BigStackRecordRow = {
  id: string;
  name: string;
  event_code: BigStackEventId;
  solve_count: number;
  player_id: string | null;
  wca_id: string;
  achieved_at: string | null;
  meet_id: string | null;
  meet_title: string | null;
  source_label: string;
  note: string;
  updated_at: string;
};

type WeeklyIdentityRow = { id: string; name: string; wca_id: string };
type Queryable = Pool | PoolClient;

export function isBigStackEvent(value: string): value is BigStackEventId {
  return BIG_STACK_EVENTS.some((event) => event.id === value);
}

export function getBigStackEventName(eventId: string) {
  return BIG_STACK_EVENTS.find((event) => event.id === eventId)?.name || "三阶";
}

export async function listBigStackRecords(eventId: BigStackEventId): Promise<BigStackRecord[]> {
  const rows = await listRecordRows(getPostgresPool(), eventId);
  return assignRanks(rows.map(mapRecordRow));
}

export async function listBigStackRevisions(options: { recordId?: string; limit?: number } = {}) {
  const requestedLimit = Number(options.limit || 50);
  const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, Math.floor(requestedLimit))) : 50;
  const values: Array<string | number> = [];
  let where = "";
  if (options.recordId) {
    values.push(options.recordId);
    where = "WHERE record_id = $1";
  }
  values.push(limit);
  const { rows } = await getPostgresPool().query<{
    id: string;
    record_id: string;
    action: string;
    reason: string;
    before_record: Record<string, unknown> | null;
    after_record: Record<string, unknown> | null;
    points_awarded: number;
    import_batch_id: string | null;
    created_at: string;
  }>(`
    SELECT id, record_id, action, reason, before_record, after_record, points_awarded, import_batch_id, created_at
      FROM weekly_big_stack_record_revisions
      ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT $${values.length}
  `, values);
  return rows.map((row) => ({
    id: Number(row.id),
    recordId: row.record_id,
    action: row.action,
    reason: row.reason,
    before: mapSnapshot(row.before_record),
    after: mapSnapshot(row.after_record),
    pointsAwarded: Number(row.points_awarded),
    importBatchId: row.import_batch_id || undefined,
    createdAt: row.created_at
  } satisfies BigStackRevision));
}

export async function previewBigStackImport(input: {
  rows: BigStackSpreadsheetRow[];
  eventId: BigStackEventId;
  mode: BigStackImportMode;
  errors?: string[];
  warnings?: string[];
}) {
  return buildImportPreview(getPostgresPool(), input);
}

export async function commitBigStackImport(input: {
  rows: BigStackSpreadsheetRow[];
  eventId: BigStackEventId;
  mode: BigStackImportMode;
  filename: string;
  errors?: string[];
  warnings?: string[];
}) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE weekly_big_stack_records IN EXCLUSIVE MODE");
    const preview = await buildImportPreview(client, input);
    if (preview.errors.length > 0) throw new Error(preview.errors[0]);
    const batchId = randomUUID();
    const sourceLabel = `Excel导入：${sanitizeFilename(input.filename)}`;

    if (input.mode === "baseline") {
      await client.query("DELETE FROM weekly_big_stack_records WHERE event_code = $1", [input.eventId]);
      const records = preview.rows.map((row) => ({
        id: `big-stack-${randomUUID()}`,
        name: row.name.trim(),
        event_code: input.eventId,
        solve_count: row.count,
        player_id: row.resolvedPlayerId || "",
        wca_id: row.resolvedWcaId || row.wcaId || "",
        achieved_at: normalizeDate(row.achievedAt),
        source_label: sourceLabel,
        note: row.note || ""
      }));
      if (records.length > 0) {
        await client.query(`
          INSERT INTO weekly_big_stack_records
            (id, name, event_code, solve_count, player_id, wca_id, achieved_at, meet_id, source_label, note, updated_at)
          SELECT x.id, x.name, x.event_code, x.solve_count, NULLIF(x.player_id, ''), x.wca_id,
                 NULLIF(x.achieved_at, '')::date, NULL, x.source_label, x.note, now()
            FROM jsonb_to_recordset($1::jsonb) AS x(
              id TEXT, name TEXT, event_code TEXT, solve_count INTEGER, player_id TEXT,
              wca_id TEXT, achieved_at TEXT, source_label TEXT, note TEXT
            )
        `, [JSON.stringify(records)]);
        await client.query(`
          INSERT INTO weekly_big_stack_record_revisions
            (record_id, action, reason, before_record, after_record, points_awarded, import_batch_id)
          SELECT id, 'baseline', '权威基线导入', NULL, to_jsonb(record), 0, $1
            FROM weekly_big_stack_records record
           WHERE event_code = $2
        `, [batchId, input.eventId]);
      }
    } else {
      for (const row of preview.rows) {
        if (row.action === "new") {
          const record = await insertRecord(client, {
            name: row.name,
            eventId: input.eventId,
            solveCount: row.count,
            playerId: row.resolvedPlayerId,
            wcaId: row.resolvedWcaId || row.wcaId,
            achievedAt: row.achievedAt,
            meetId: null,
            sourceLabel,
            note: row.note
          });
          await insertRevision(client, record.id, "import_new", "Excel PB 合并新增", undefined, record, 0, batchId);
        } else if (row.action === "improved" && row.existingRecordId) {
          const before = await getRecordForUpdate(client, row.existingRecordId);
          if (!before || row.count <= before.solveCount) continue;
          const after = await updateRecordRow(client, before.id, {
            ...before,
            solveCount: row.count,
            playerId: row.resolvedPlayerId || before.playerId,
            wcaId: row.resolvedWcaId || row.wcaId || before.wcaId,
            achievedAt: row.achievedAt || before.achievedAt,
            sourceLabel,
            note: row.note || before.note
          });
          await insertRevision(client, before.id, "pb", "Excel PB 合并刷新", before, after, 1, batchId);
        }
      }
    }

    await client.query(
      `INSERT INTO weekly_big_stack_import_batches (id, filename, event_code, mode, summary)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [batchId, sanitizeFilename(input.filename), input.eventId, input.mode, JSON.stringify(preview.summary)]
    );
    const records = assignRanks((await listRecordRows(client, input.eventId)).map(mapRecordRow));
    await client.query("COMMIT");
    return { preview, records, batchId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw normalizeDatabaseError(error);
  } finally {
    client.release();
  }
}

export async function createBigStackRecord(input: {
  name: string;
  eventId: BigStackEventId;
  solveCount: number;
  playerId?: string;
  wcaId?: string;
  achievedAt?: string;
  meetId?: string | null;
  sourceLabel?: string;
  note?: string;
  reason?: string;
}) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const identity = await resolveManualIdentity(client, input.playerId, input.wcaId);
    await assertNoManualDuplicate(client, input.eventId, requiredName(input.name), identity.playerId, identity.wcaId);
    const record = await insertRecord(client, {
      name: requiredName(input.name),
      eventId: input.eventId,
      solveCount: requiredCount(input.solveCount),
      playerId: identity.playerId,
      wcaId: identity.wcaId,
      achievedAt: input.achievedAt,
      meetId: input.meetId || null,
      sourceLabel: input.sourceLabel?.trim() || "管理员录入",
      note: input.note
    });
    await insertRevision(client, record.id, "create", input.reason?.trim() || "管理员新增", undefined, record);
    await client.query("COMMIT");
    return record;
  } catch (error) {
    await client.query("ROLLBACK");
    throw normalizeDatabaseError(error);
  } finally {
    client.release();
  }
}

export async function updateBigStackRecord(id: string, input: {
  name: string;
  eventId: BigStackEventId;
  solveCount: number;
  playerId?: string;
  wcaId?: string;
  achievedAt?: string;
  meetId?: string | null;
  sourceLabel?: string;
  note?: string;
  reason?: string;
}) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const before = await getRecordForUpdate(client, id);
    if (!before) throw new Error("未找到这条大堆记录");
    const identity = await resolveManualIdentity(client, input.playerId, input.wcaId);
    const name = requiredName(input.name);
    const solveCount = requiredCount(input.solveCount);
    const identityChanged = name !== before.name || input.eventId !== before.eventId ||
      identity.playerId !== before.playerId || identity.wcaId !== before.wcaId;
    if ((solveCount < before.solveCount || identityChanged) && !input.reason?.trim()) throw new Error("降低成绩或修改选手身份时必须填写原因");
    await assertNoManualDuplicate(client, input.eventId, name, identity.playerId, identity.wcaId, id);
    const after = await updateRecordRow(client, id, {
      ...before,
      name,
      eventId: input.eventId,
      solveCount,
      playerId: identity.playerId,
      wcaId: identity.wcaId,
      achievedAt: normalizeDate(input.achievedAt),
      meetId: input.meetId || null,
      sourceLabel: input.sourceLabel?.trim() || "",
      note: input.note?.trim() || ""
    });
    const improved = after.solveCount > before.solveCount;
    await insertRevision(client, id, improved ? "pb" : "correct", input.reason?.trim() || (improved ? "管理员刷新 PB" : "管理员修改"), before, after, improved ? 1 : 0);
    await client.query("COMMIT");
    return after;
  } catch (error) {
    await client.query("ROLLBACK");
    throw normalizeDatabaseError(error);
  } finally {
    client.release();
  }
}

export async function deleteBigStackRecord(id: string, reason: string) {
  if (!reason.trim()) throw new Error("删除记录时必须填写原因");
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const before = await getRecordForUpdate(client, id);
    if (!before) throw new Error("未找到这条大堆记录");
    await client.query("DELETE FROM weekly_big_stack_records WHERE id = $1", [id]);
    await insertRevision(client, id, "delete", reason.trim(), before, undefined);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw normalizeDatabaseError(error);
  } finally {
    client.release();
  }
}

async function buildImportPreview(db: Queryable, input: {
  rows: BigStackSpreadsheetRow[];
  eventId: BigStackEventId;
  mode: BigStackImportMode;
  errors?: string[];
  warnings?: string[];
}): Promise<BigStackImportPreview> {
  const [identities, existingRows] = await Promise.all([listWeeklyIdentities(db), listRecordRows(db, input.eventId)]);
  const identityMaps = buildIdentityMaps(identities);
  const existingMaps = buildExistingMaps(existingRows.map(mapRecordRow));
  const warnings = [...(input.warnings || [])];
  const rows = input.rows.map((row): BigStackImportPreviewRow => {
    const identity = matchWeeklyIdentity(row, identityMaps);
    if (identity.message) warnings.push(`第 ${row.rowNumber} 行“${row.name}”：${identity.message}`);
    const existingMatch = findExistingRecord(row, identity, existingMaps);
    if (input.mode === "baseline") return { ...row, action: "replace", matchMethod: identity.method, resolvedPlayerId: identity.playerId, resolvedWcaId: identity.wcaId, message: identity.message };
    if (existingMatch.ambiguous) return { ...row, action: "ambiguous", matchMethod: identity.method, resolvedPlayerId: identity.playerId, resolvedWcaId: identity.wcaId, message: "现有榜单存在多条同名记录，需要管理员手动处理" };
    if (!existingMatch.record) return { ...row, action: "new", matchMethod: identity.method, resolvedPlayerId: identity.playerId, resolvedWcaId: identity.wcaId, message: identity.message };
    const record = existingMatch.record;
    const action: BigStackImportAction = row.count > record.solveCount ? "improved" : row.count === record.solveCount ? "unchanged" : "lower";
    return { ...row, action, matchMethod: identity.method, resolvedPlayerId: identity.playerId, resolvedWcaId: identity.wcaId, currentCount: record.solveCount, existingRecordId: record.id, message: identity.message };
  });

  const errors = [...(input.errors || [])];
  const resolvedKeys = new Map<string, number>();
  for (const row of rows) {
    const key = row.resolvedPlayerId ? `周赛选手 ${row.resolvedPlayerId}` : row.resolvedWcaId ? `WCA ID ${row.resolvedWcaId}` : "";
    if (!key) continue;
    const earlierRow = resolvedKeys.get(key);
    if (earlierRow) errors.push(`第 ${earlierRow}、${row.rowNumber} 行匹配到了同一位选手（${key}）`);
    else resolvedKeys.set(key, row.rowNumber);
  }
  const countAction = (action: BigStackImportAction) => rows.filter((row) => row.action === action).length;
  return {
    eventId: input.eventId,
    mode: input.mode,
    rows,
    errors,
    warnings: [...new Set(warnings)],
    summary: {
      total: rows.length,
      replace: countAction("replace"),
      inserted: countAction("new"),
      improved: countAction("improved"),
      unchanged: countAction("unchanged"),
      lowerIgnored: countAction("lower"),
      unresolved: rows.filter((row) => row.matchMethod === "unmatched").length,
      ambiguous: rows.filter((row) => row.matchMethod === "ambiguous" || row.action === "ambiguous").length
    }
  };
}

async function listRecordRows(db: Queryable, eventId: BigStackEventId) {
  const { rows } = await db.query<BigStackRecordRow>(`
    SELECT record.id, record.name, record.event_code, record.solve_count, record.player_id,
           record.wca_id, record.achieved_at::text, record.meet_id, meet.title AS meet_title,
           record.source_label, record.note, record.updated_at
      FROM weekly_big_stack_records record
      LEFT JOIN weekly_meets meet ON meet.id = record.meet_id
     WHERE record.event_code = $1
     ORDER BY record.solve_count DESC, record.name ASC
  `, [eventId]);
  return rows;
}

async function listWeeklyIdentities(db: Queryable): Promise<WeeklyIdentityRow[]> {
  return (await db.query<WeeklyIdentityRow>("SELECT id, name, wca_id FROM weekly_player_library")).rows;
}

function buildIdentityMaps(rows: WeeklyIdentityRow[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const byWca = new Map<string, WeeklyIdentityRow[]>();
  const byName = new Map<string, WeeklyIdentityRow[]>();
  for (const row of rows) {
    if (row.wca_id) byWca.set(row.wca_id.toUpperCase(), [...(byWca.get(row.wca_id.toUpperCase()) || []), row]);
    const name = normalizeName(row.name);
    byName.set(name, [...(byName.get(name) || []), row]);
  }
  return { byId, byWca, byName };
}

function matchWeeklyIdentity(row: BigStackSpreadsheetRow, maps: ReturnType<typeof buildIdentityMaps>) {
  if (row.playerId) {
    const player = maps.byId.get(row.playerId);
    if (player) return { method: "player_id" as const, playerId: player.id, wcaId: player.wca_id || row.wcaId };
    return { method: "unmatched" as const, wcaId: row.wcaId, message: `周赛选手 ID ${row.playerId} 不存在，已作为未绑定记录处理` };
  }
  if (row.wcaId) {
    const matches = maps.byWca.get(row.wcaId.toUpperCase()) || [];
    if (matches.length === 1) return { method: "wca_id" as const, playerId: matches[0].id, wcaId: row.wcaId.toUpperCase() };
    if (matches.length > 1) return { method: "ambiguous" as const, wcaId: row.wcaId.toUpperCase(), message: "WCA ID 匹配到多个周赛选手，暂不绑定" };
    return { method: "unmatched" as const, wcaId: row.wcaId.toUpperCase(), message: "WCA ID 尚未进入周赛选手库" };
  }
  const matches = maps.byName.get(normalizeName(row.name)) || [];
  if (matches.length === 1) return { method: "exact_name" as const, playerId: matches[0].id, wcaId: matches[0].wca_id || undefined };
  if (matches.length > 1) return { method: "ambiguous" as const, message: "周赛选手库存在同名选手，暂不自动绑定" };
  return { method: "unmatched" as const, message: "未找到唯一的同名周赛选手" };
}

function buildExistingMaps(records: BigStackRecord[]) {
  const byPlayer = new Map(records.filter((row) => row.playerId).map((row) => [row.playerId as string, row]));
  const byWca = new Map(records.filter((row) => row.wcaId).map((row) => [row.wcaId as string, row]));
  const byName = new Map<string, BigStackRecord[]>();
  for (const row of records) byName.set(normalizeName(row.name), [...(byName.get(normalizeName(row.name)) || []), row]);
  return { byPlayer, byWca, byName };
}

function findExistingRecord(row: BigStackSpreadsheetRow, identity: ReturnType<typeof matchWeeklyIdentity>, maps: ReturnType<typeof buildExistingMaps>) {
  if (identity.playerId && maps.byPlayer.has(identity.playerId)) return { record: maps.byPlayer.get(identity.playerId) };
  const wcaId = identity.wcaId || row.wcaId;
  if (wcaId && maps.byWca.has(wcaId)) return { record: maps.byWca.get(wcaId) };
  const nameMatches = maps.byName.get(normalizeName(row.name)) || [];
  if (nameMatches.length === 1) return { record: nameMatches[0] };
  return { record: undefined, ambiguous: nameMatches.length > 1 };
}

async function resolveManualIdentity(db: Queryable, playerId?: string, wcaId?: string) {
  const cleanPlayerId = playerId?.trim() || "";
  const cleanWcaId = wcaId?.trim().toUpperCase() || "";
  if (cleanPlayerId) {
    const { rows } = await db.query<WeeklyIdentityRow>("SELECT id, name, wca_id FROM weekly_player_library WHERE id = $1", [cleanPlayerId]);
    if (!rows[0]) throw new Error("选择的周赛选手不存在");
    if (cleanWcaId && rows[0].wca_id && cleanWcaId !== rows[0].wca_id.toUpperCase()) throw new Error("WCA ID 与所选周赛选手不一致");
    return { playerId: rows[0].id, wcaId: cleanWcaId || rows[0].wca_id || undefined };
  }
  if (cleanWcaId) {
    const { rows } = await db.query<WeeklyIdentityRow>("SELECT id, name, wca_id FROM weekly_player_library WHERE upper(wca_id) = $1", [cleanWcaId]);
    if (rows.length === 1) return { playerId: rows[0].id, wcaId: cleanWcaId };
  }
  return { playerId: undefined, wcaId: cleanWcaId || undefined };
}

async function assertNoManualDuplicate(db: Queryable, eventId: BigStackEventId, name: string, playerId?: string, wcaId?: string, excludeId = "") {
  const conditions: string[] = [];
  const values: string[] = [eventId, excludeId];
  if (playerId) { values.push(playerId); conditions.push(`player_id = $${values.length}`); }
  if (wcaId) { values.push(wcaId.toUpperCase()); conditions.push(`upper(wca_id) = $${values.length}`); }
  if (!playerId && !wcaId) { values.push(name); conditions.push(`name = $${values.length}`); }
  const result = await db.query(
    `SELECT id FROM weekly_big_stack_records WHERE event_code = $1 AND id <> $2 AND (${conditions.join(" OR ")}) LIMIT 1`,
    values
  );
  if (result.rows[0]) throw new Error("这位选手已经有该项目的大堆记录，请直接编辑原记录");
}

async function insertRecord(db: Queryable, input: {
  name: string; eventId: BigStackEventId; solveCount: number; playerId?: string; wcaId?: string;
  achievedAt?: string; meetId: string | null; sourceLabel?: string; note?: string;
}) {
  const id = `big-stack-${randomUUID()}`;
  const { rows } = await db.query<BigStackRecordRow>(`
    INSERT INTO weekly_big_stack_records
      (id, name, event_code, solve_count, player_id, wca_id, achieved_at, meet_id, source_label, note, updated_at)
    VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, NULLIF($7, '')::date, $8, $9, $10, now())
    RETURNING id, name, event_code, solve_count, player_id, wca_id, achieved_at::text, meet_id,
              NULL::text AS meet_title, source_label, note, updated_at
  `, [id, requiredName(input.name), input.eventId, requiredCount(input.solveCount), input.playerId || "", input.wcaId || "", normalizeDate(input.achievedAt), input.meetId, input.sourceLabel?.trim() || "", input.note?.trim() || ""]);
  return mapRecordRow(rows[0]);
}

async function updateRecordRow(db: Queryable, id: string, input: BigStackRecord) {
  const { rows } = await db.query<BigStackRecordRow>(`
    UPDATE weekly_big_stack_records
       SET name = $2, event_code = $3, solve_count = $4, player_id = NULLIF($5, ''), wca_id = $6,
           achieved_at = NULLIF($7, '')::date, meet_id = $8, source_label = $9, note = $10, updated_at = now()
     WHERE id = $1
    RETURNING id, name, event_code, solve_count, player_id, wca_id, achieved_at::text, meet_id,
              NULL::text AS meet_title, source_label, note, updated_at
  `, [id, requiredName(input.name), input.eventId, requiredCount(input.solveCount), input.playerId || "", input.wcaId || "", normalizeDate(input.achievedAt), input.meetId, input.sourceLabel.trim(), input.note.trim()]);
  if (!rows[0]) throw new Error("未找到这条大堆记录");
  return mapRecordRow(rows[0]);
}

async function getRecordForUpdate(db: Queryable, id: string) {
  const { rows } = await db.query<BigStackRecordRow>(`
    SELECT record.id, record.name, record.event_code, record.solve_count, record.player_id,
           record.wca_id, record.achieved_at::text, record.meet_id, meet.title AS meet_title,
           record.source_label, record.note, record.updated_at
      FROM weekly_big_stack_records record
      LEFT JOIN weekly_meets meet ON meet.id = record.meet_id
     WHERE record.id = $1 FOR UPDATE OF record
  `, [id]);
  return rows[0] ? mapRecordRow(rows[0]) : null;
}

async function insertRevision(db: Queryable, recordId: string, action: string, reason: string, before?: BigStackRecord, after?: BigStackRecord, pointsAwarded = 0, importBatchId?: string) {
  await db.query(`
    INSERT INTO weekly_big_stack_record_revisions
      (record_id, action, reason, before_record, after_record, points_awarded, import_batch_id)
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
  `, [recordId, action, reason, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, pointsAwarded, importBatchId || null]);
}

function mapRecordRow(row: BigStackRecordRow): BigStackRecord {
  return {
    id: row.id, name: row.name, eventId: row.event_code, solveCount: Number(row.solve_count),
    playerId: row.player_id || undefined, wcaId: row.wca_id || undefined, achievedAt: row.achieved_at || undefined,
    meetId: row.meet_id, meetTitle: row.meet_title || "", sourceLabel: row.source_label || "", note: row.note || "",
    rank: 0, updatedAt: row.updated_at
  };
}

function mapSnapshot(value: Record<string, unknown> | null | undefined): BigStackRecord | undefined {
  if (!value) return undefined;
  const eventId = String(value.eventId || value.event_code || "333");
  if (!isBigStackEvent(eventId)) return undefined;
  return {
    id: String(value.id || ""), name: String(value.name || ""), eventId,
    solveCount: Number(value.solveCount ?? value.solve_count ?? 0),
    playerId: String(value.playerId || value.player_id || "") || undefined,
    wcaId: String(value.wcaId || value.wca_id || "") || undefined,
    achievedAt: String(value.achievedAt || value.achieved_at || "") || undefined,
    meetId: String(value.meetId || value.meet_id || "") || null,
    meetTitle: String(value.meetTitle || value.meet_title || ""),
    sourceLabel: String(value.sourceLabel || value.source_label || ""), note: String(value.note || ""),
    rank: Number(value.rank || 0), updatedAt: String(value.updatedAt || value.updated_at || "")
  };
}

function assignRanks(records: BigStackRecord[]) {
  let previousCount: number | null = null;
  let previousRank = 0;
  return records.map((record, index) => {
    const rank = previousCount === record.solveCount ? previousRank : index + 1;
    previousCount = record.solveCount;
    previousRank = rank;
    return { ...record, rank };
  });
}

function requiredName(value?: string) {
  const name = value?.trim() || "";
  if (!name) throw new Error("请填写选手姓名");
  if (name.length > 80) throw new Error("选手姓名过长");
  return name;
}

function requiredCount(value?: number) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0 || count > 10_000) throw new Error("还原数量必须是 0 到 10000 之间的整数");
  return count;
}

function normalizeDate(value?: string) {
  const date = value?.trim() || "";
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("达成日期格式应为 YYYY-MM-DD");
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) throw new Error("达成日期不正确");
  return date;
}

function normalizeName(name: string) { return name.trim().replace(/\s+/g, " "); }
function sanitizeFilename(filename: string) { return filename.replace(/[\\/\0]/g, "_").slice(0, 160) || "大堆记录.xlsx"; }

function normalizeDatabaseError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "23505") return new Error("这个周赛选手或 WCA ID 已绑定到另一条同项目大堆记录");
  return error instanceof Error ? error : new Error("保存大堆记录失败");
}
