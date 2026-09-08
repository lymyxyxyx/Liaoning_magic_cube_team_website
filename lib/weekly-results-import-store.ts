import { createHash, randomUUID } from "node:crypto";
import { getPostgresPool } from "@/lib/postgres";
import { calculateResultByFormat, formatResult, getWeeklyResultFormat, resultValueToSeconds, type ResultValue } from "@/lib/weekly-result-utils";
import { normalizePastedWeeklyResults, normalizeWeeklyResultRow, type NormalizedWeeklyResultRow } from "@/lib/weekly-results-import";
import { buildWeeklyPlayerImportMatch, type WeeklyImportPlayerCandidate } from "@/lib/weekly-player-import";
import { createWeeklyResultsTemplate, parseWeeklyResultsWorkbook, type ParsedWeeklyResultsWorkbook, type WeeklyResultTemplateMeet } from "@/lib/weekly-results-xlsx";
import { refreshWeeklyPlayerPersonalBestForEvent, rerankWeeklyEvent } from "@/lib/weekly-entry-store";
import { weeklyV2ActivePlayerSql } from "@/lib/weekly-player-scope";
import { getWeeklyAgeGroup } from "@/lib/weekly-age-groups";
import type { PoolClient } from "pg";

export type WeeklyResultsImportPreviewRow = NormalizedWeeklyResultRow & {
  candidates: WeeklyImportPlayerCandidate[];
  recommendedPlayerId: string;
  handlingStatus: "exact" | "recommended" | "needs_resolution" | "unmatched" | "blocked";
  matchedPlayerName: string;
  matchedPlayerStatus: "active" | "inactive" | "";
  existingResult: boolean;
  duplicateExcelRow: boolean;
  bestText: string;
  averageText: string;
};

export type WeeklyResultsImportPreview = {
  parser: "weekly-results-template-v1" | "weekly-results-paste-v1";
  source: "xlsx" | "paste";
  meetId: string;
  metadata: Record<string, string>;
  globalWarnings: string[];
  globalErrors: string[];
  rawRowCount: number;
  validRowCount: number;
  warningCount: number;
  errorCount: number;
  exactPlayerIdMatchCount: number;
  wcaIdMatchCount: number;
  nameRecommendationCount: number;
  unmatchedCount: number;
  conflictCount: number;
  existingResultCount: number;
  rows: WeeklyResultsImportPreviewRow[];
};

export type WeeklyResultsImportBatch = {
  id: string;
  kind: "results";
  filename: string;
  status: "parsed" | "needs_review" | "ready" | "committed" | "failed" | "rolled_back";
  rawRowCount: number;
  validRowCount: number;
  warningCount: number;
  errorCount: number;
  preview: WeeklyResultsImportPreview;
  commitManifest: WeeklyResultsImportCommitManifest;
  createdAt: string;
  committedAt: string | null;
  rolledBackAt: string | null;
};

type ImportMeetContext = WeeklyResultTemplateMeet & { id: string; events: Array<{ id: string; eventCode: string; format: string; attemptCount: number; enabled: boolean }>; players: WeeklyImportPlayerCandidate[] };
export type WeeklyResultsImportCommitManifest = {
  resultIds?: number[];
  results?: Array<{
    id: number;
    eventId: string;
    eventCode: string;
    playerId: string;
    resultUpdatedAt: string;
  }>;
  rollback?: { resultIds: number[]; rolledBackAt: string };
};

type BatchRow = {
  id: string;
  filename: string;
  file_sha256: string;
  status: WeeklyResultsImportBatch["status"];
  raw_row_count: number;
  valid_row_count: number;
  warning_count: number;
  error_count: number;
  preview_jsonb: unknown;
  commit_manifest_jsonb: unknown;
  created_at: string;
  committed_at: string | null;
  rolled_back_at: string | null;
};

export async function getWeeklyResultsTemplate(meetId: string) {
  const context = await getImportContext(meetId);
  return { filename: `weekly-results-${context.slug}.xlsx`, buffer: createWeeklyResultsTemplate(context) };
}

export async function createWeeklyResultsImportPreview(input: { meetId: string; filename: string; buffer?: Buffer; paste?: string; pasteEventCode?: string; actor: string }) {
  const context = await getImportContext(input.meetId);
  let parsed: ParsedWeeklyResultsWorkbook | null = null;
  let rawRows: NormalizedWeeklyResultRow[];
  let metadata: Record<string, string>;
  let source: WeeklyResultsImportPreview["source"];
  let parser: WeeklyResultsImportPreview["parser"];
  if (input.buffer) {
    parsed = await parseWeeklyResultsWorkbook(input.buffer);
    source = "xlsx"; parser = "weekly-results-template-v1"; metadata = parsed.metadata;
    rawRows = parsed.rows.map((row) => normalizeForEvent(row.values.event_code, row.values, row.sourceRow, context));
  } else {
    const text = input.paste?.trim() || "";
    if (!text) throw new Error("请粘贴成绩内容");
    const eventCode = input.pasteEventCode?.trim() || "";
    const event = context.events.find((item) => item.eventCode === eventCode && item.enabled);
    if (!event) throw new Error("请选择当前周赛已启用的项目后再粘贴");
    source = "paste"; parser = "weekly-results-paste-v1";
    metadata = { meet_slug: context.slug, week_number: String(context.weekNumber), title: context.title, start_date: context.startDate, end_date: context.endDate };
    rawRows = normalizePastedWeeklyResults(text, { eventCode, format: event.format });
  }
  const preview = await buildPreview({ context, source, parser, metadata, rows: rawRows });
  const payload = input.buffer || Buffer.from(`${input.pasteEventCode || ""}\n${input.paste || ""}`, "utf8");
  const id = `weekly-results-import-${randomUUID()}`;
  const status = preview.globalErrors.length || preview.errorCount ? "needs_review" : preview.validRowCount === preview.rawRowCount ? "ready" : "parsed";
  const pool = getPostgresPool();
  const { rows } = await pool.query<BatchRow>(
    `INSERT INTO weekly_import_batches (id, kind, filename, file_sha256, status, raw_row_count, valid_row_count, warning_count, error_count, preview_jsonb, commit_manifest_jsonb, admin_actor)
     VALUES ($1,'results',$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'{}'::jsonb,$10) RETURNING *`,
    [id, sanitizeFilename(input.filename), createHash("sha256").update(payload).digest("hex"), status, preview.rawRowCount, preview.validRowCount, preview.warningCount, preview.errorCount, JSON.stringify(preview), input.actor]
  );
  return mapBatch(rows[0]);
}

export async function getWeeklyResultsImportBatch(id: string, meetId: string) {
  const pool = getPostgresPool();
  const { rows } = await pool.query<BatchRow>("SELECT * FROM weekly_import_batches WHERE id = $1 AND kind = 'results'", [id]);
  const batch = rows[0];
  if (!batch) return null;
  const preview = parsePreview(batch.preview_jsonb);
  return preview.meetId === meetId ? mapBatch(batch) : null;
}

export async function resolveWeeklyResultsImportPlayers(input: { batchId: string; meetId: string; resolutions: Array<{ sourceRow: number; playerId: string }>; actor: string }) {
  const pool = getPostgresPool();
  const existing = await getWeeklyResultsImportBatch(input.batchId, input.meetId);
  if (!existing) throw new Error("导入批次不存在");
  if (existing.status === "committed" || existing.status === "rolled_back") throw new Error("已提交或已回滚的批次不能再修改选手匹配");
  const context = await getImportContext(input.meetId);
  const chosen = new Map(existing.preview.rows.filter((row) => row.matchedPlayerId).map((row) => [row.sourceRow, row.matchedPlayerId]));
  for (const resolution of input.resolutions) chosen.set(resolution.sourceRow, resolution.playerId);
  const previous = existing.preview;
  const rows = previous.rows.map((row) => ({
    ...row,
    warnings: row.warnings.filter((message) => !["唯一姓名仅作为推荐", "同名多人", "近似姓名", "WCA ID 对应", "匹配到 inactive", "player_id 与 Excel", "已手动选择选手"].some((prefix) => message.startsWith(prefix))),
    errors: row.errors.filter((message) => !["event_code 不属于", "该项目要求", "缺少 player_id", "player_id 不存在", "手动选择的选手", "该选手已停用", "已有成绩", "Excel 中存在"].some((prefix) => message.startsWith(prefix)))
  }));
  const preview = await buildPreview({ context, source: previous.source, parser: previous.parser, metadata: previous.metadata, rows, forcedPlayerIds: chosen, globalWarnings: previous.globalWarnings, globalErrors: previous.globalErrors });
  const status = preview.globalErrors.length || preview.errorCount ? "needs_review" : preview.validRowCount === preview.rawRowCount ? "ready" : "parsed";
  const { rows: updated } = await pool.query<BatchRow>(
    `UPDATE weekly_import_batches SET status = $2, raw_row_count = $3, valid_row_count = $4, warning_count = $5, error_count = $6, preview_jsonb = $7::jsonb, admin_actor = $8
     WHERE id = $1 AND kind = 'results' RETURNING *`,
    [input.batchId, status, preview.rawRowCount, preview.validRowCount, preview.warningCount, preview.errorCount, JSON.stringify(preview), input.actor]
  );
  return mapBatch(updated[0]);
}

/**
 * Atomically promotes a reviewed result preview into canonical weekly results.
 * The saved preview is treated as input only: result summaries are always
 * recalculated from canonical attempt values inside this transaction.
 */
export async function commitWeeklyResultsImportBatch(input: { id: string; meetId: string; actor: string }) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const batchResult = await client.query<BatchRow>(
      "SELECT * FROM weekly_import_batches WHERE id = $1 AND kind = 'results' FOR UPDATE",
      [input.id]
    );
    const batch = batchResult.rows[0];
    if (!batch) throw new Error("导入批次不存在");
    if (batch.status === "committed") throw new Error("该成绩导入批次已经提交");
    if (batch.status === "rolled_back") throw new Error("已回滚的成绩导入批次不能再次提交");
    if (batch.status !== "ready") throw new Error("只有 ready 状态且没有错误的预览可以提交");
    const duplicate = await client.query<{ id: string }>(
      `SELECT id FROM weekly_import_batches
        WHERE kind = 'results' AND file_sha256 = $1 AND status = 'committed' AND id <> $2
        LIMIT 1`,
      [batch.file_sha256, batch.id]
    );
    if (duplicate.rows[0]) throw new Error("该文件已经成功提交过成绩，不能重复提交");

    const preview = parsePreview(batch.preview_jsonb);
    if (preview.meetId !== input.meetId) throw new Error("导入批次不属于当前周赛");
    assertReadyPreview(preview, batch);
    const meet = await client.query<{ id: string; starts_at: string | null; data_version: number }>(
      "SELECT id, starts_at, data_version FROM weekly_meets WHERE id = $1 FOR SHARE",
      [input.meetId]
    );
    if (!meet.rows[0]) throw new Error("周赛不存在，不能提交成绩");
    if (meet.rows[0].data_version !== 2) throw new Error("历史数据 / 只读");

    const eventRows = await client.query<{ id: string; event_code: string; format: string; attempt_count: number; enabled: boolean }>(
      `SELECT id, event_code, format, attempt_count, enabled
         FROM weekly_events WHERE meet_id = $1 FOR SHARE`,
      [input.meetId]
    );
    const events = new Map(eventRows.rows.map((event) => [event.event_code, event]));
    const manifest: WeeklyResultsImportCommitManifest = { resultIds: [], results: [] };
    const affectedEvents = new Set<string>();
    const affectedPlayerEvents = new Map<string, { playerId: string; eventCode: string }>();

    for (const row of preview.rows) {
      const event = events.get(row.eventCode);
      if (!event || !event.enabled) throw new Error(`第 ${row.sourceRow} 行的项目已停用或不存在`);
      const format = getWeeklyResultFormat(event.format);
      if (event.attempt_count !== format.attemptCount || row.attempts.length !== format.attemptCount) {
        throw new Error(`第 ${row.sourceRow} 行的项目赛制或尝试次数已变化，请重新生成预览`);
      }
      if (!row.matchedPlayerId) throw new Error(`第 ${row.sourceRow} 行没有正式 player_id，不能提交`);
      const player = await client.query<{ id: string; name: string; gender: string; birth_date: string; status: string }>(
        `SELECT id, name, gender, birth_date, status
           FROM weekly_player_library WHERE id = $1 AND ${weeklyV2ActivePlayerSql()} FOR UPDATE`,
        [row.matchedPlayerId]
      );
      const selected = player.rows[0];
      if (!selected) throw new Error(`第 ${row.sourceRow} 行关联的选手已不存在，请重新生成预览`);
      if (selected.status !== "active") throw new Error(`第 ${row.sourceRow} 行关联的选手已停用，不能提交`);
      const existing = await client.query<{ id: number }>(
        `SELECT id FROM weekly_results WHERE meet_id = $1 AND event_id = $2 AND player_id = $3 LIMIT 1`,
        [input.meetId, event.id, selected.id]
      );
      if (existing.rows[0]) throw new Error(`第 ${row.sourceRow} 行已有正式成绩冲突；本轮不会覆盖已有成绩`);

      // The preview has already validated syntax, but calculation runs again
      // from its canonical attempt values while holding the commit transaction.
      const attempts = row.attempts as ResultValue[];
      const previousPbs = await client.query<{ personal_bests: Record<string, unknown> | null; personal_bests_average: Record<string, unknown> | null }>(
        "SELECT personal_bests, personal_bests_average FROM weekly_player_library WHERE id = $1 FOR UPDATE",
        [selected.id]
      );
      // Freeze pre-import PB state before any batch result exists. Refreshing
      // after rollback must never turn the imported current PB into baseline.
      await client.query(
        `UPDATE weekly_player_library
            SET personal_bests_base = CASE WHEN personal_bests_base = '{}'::jsonb THEN COALESCE(personal_bests, '{}'::jsonb) ELSE personal_bests_base END,
                personal_bests_average_base = CASE WHEN personal_bests_average_base = '{}'::jsonb THEN COALESCE(personal_bests_average, '{}'::jsonb) ELSE personal_bests_average_base END
          WHERE id = $1`,
        [selected.id]
      );
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO weekly_results
          (event_id, meet_id, rank, player_id, player_name, player_slug, gender, age_group,
           level, grade, average, personal_best, pb_refreshed, pb_average_refreshed,
           source, import_batch_id, updated_at)
         VALUES ($1,$2,0,$3,$4,'',$5,$6,'', '', -1, -1, FALSE, FALSE,
                 'results_excel_import',$7,now())
         RETURNING id`,
        [event.id, input.meetId, selected.id, selected.name, selected.gender === "女" ? "女" : "男", getWeeklyAgeGroup(selected.birth_date || "", meet.rows[0].starts_at ? new Date(meet.rows[0].starts_at) : new Date()) || null, batch.id]
      );
      const resultId = inserted.rows[0].id;
      await insertImportedAttempts(client, resultId, attempts);
      const calculated = calculateResultByFormat(attempts, format.id);
      const pbKey = personalBestKey(row.eventCode);
      const best = resultValueToSeconds(calculated.best);
      const average = resultValueToSeconds(calculated.average);
      const priorBest = storedPositiveValue(previousPbs.rows[0]?.personal_bests?.[pbKey]);
      const priorAverage = storedPositiveValue(previousPbs.rows[0]?.personal_bests_average?.[pbKey]);
      await client.query(
        `UPDATE weekly_results
            SET average = $1, personal_best = $2,
                pb_refreshed = $3, pb_average_refreshed = $4, updated_at = now()
          WHERE id = $5`,
        [average, best, best >= 0 && (priorBest === null || best < priorBest), average >= 0 && (priorAverage === null || average < priorAverage), resultId]
      );
      const saved = await client.query<{ updated_at: string }>("SELECT updated_at FROM weekly_results WHERE id = $1", [resultId]);
      manifest.resultIds!.push(resultId);
      manifest.results!.push({ id: resultId, eventId: event.id, eventCode: row.eventCode, playerId: selected.id, resultUpdatedAt: new Date(saved.rows[0].updated_at).toISOString() });
      affectedEvents.add(event.id);
      affectedPlayerEvents.set(`${selected.id}:${row.eventCode}`, { playerId: selected.id, eventCode: row.eventCode });
    }

    for (const item of affectedPlayerEvents.values()) await refreshWeeklyPlayerPersonalBestForEvent(client, item.playerId, item.eventCode);
    for (const eventId of affectedEvents) await rerankWeeklyEvent(client, input.meetId, eventId);
    await client.query(
      `UPDATE weekly_import_batches
          SET commit_manifest_jsonb = $2::jsonb, status = 'committed', admin_actor = $3,
              committed_at = now()
        WHERE id = $1`,
      [batch.id, JSON.stringify(manifest), input.actor]
    );
    await client.query("COMMIT");
    return await getWeeklyResultsImportBatch(batch.id, input.meetId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Rolls back only results created by this batch, unless they were later revised. */
export async function rollbackWeeklyResultsImportBatch(input: { id: string; meetId: string; actor: string }) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const batchResult = await client.query<BatchRow>(
      "SELECT * FROM weekly_import_batches WHERE id = $1 AND kind = 'results' FOR UPDATE",
      [input.id]
    );
    const batch = batchResult.rows[0];
    if (!batch || parsePreview(batch.preview_jsonb).meetId !== input.meetId) throw new Error("导入批次不存在");
    if (batch.status !== "committed") throw new Error("只有已提交的成绩导入批次可以回滚");
    const writable = await client.query<{ data_version: number }>("SELECT data_version FROM weekly_meets WHERE id = $1 FOR SHARE", [input.meetId]);
    if (writable.rows[0]?.data_version !== 2) throw new Error("历史数据 / 只读");
    const manifest = parseManifest(batch.commit_manifest_jsonb);
    if (!manifest.results?.length) throw new Error("提交清单缺少本批成绩，不能自动回滚");

    const affectedEvents = new Set<string>();
    const affectedPlayerEvents = new Map<string, { playerId: string; eventCode: string }>();
    for (const item of manifest.results) {
      const current = await client.query<{ id: number; event_id: string; player_id: string | null; source: string; import_batch_id: string | null; updated_at: string }>(
        "SELECT id, event_id, player_id, source, import_batch_id, updated_at FROM weekly_results WHERE id = $1 FOR UPDATE",
        [item.id]
      );
      const result = current.rows[0];
      if (!result || result.event_id !== item.eventId || result.player_id !== item.playerId || result.import_batch_id !== batch.id || result.source !== "results_excel_import") {
        throw new Error(`成绩 ${item.id} 已被删除、替换或不再属于本批次，需人工处理，已阻止自动回滚`);
      }
      if (new Date(result.updated_at).getTime() !== new Date(item.resultUpdatedAt).getTime()) {
        throw new Error(`成绩 ${item.id} 在导入后已被人工修订，需人工处理，已阻止自动回滚`);
      }
      const revisions = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM weekly_result_revisions WHERE result_id = $1", [item.id]);
      if (Number(revisions.rows[0]?.count || 0) > 0) throw new Error(`成绩 ${item.id} 已有后续修订记录，需人工处理，已阻止自动回滚`);
      affectedEvents.add(item.eventId);
      affectedPlayerEvents.set(`${item.playerId}:${item.eventCode}`, { playerId: item.playerId, eventCode: item.eventCode });
    }
    const resultIds = manifest.results.map((item) => item.id);
    await client.query("DELETE FROM weekly_attempts WHERE result_id = ANY($1::int[])", [resultIds]);
    await client.query("DELETE FROM weekly_results WHERE id = ANY($1::int[]) AND import_batch_id = $2", [resultIds, batch.id]);
    for (const item of affectedPlayerEvents.values()) await refreshWeeklyPlayerPersonalBestForEvent(client, item.playerId, item.eventCode);
    for (const eventId of affectedEvents) await rerankWeeklyEvent(client, input.meetId, eventId);
    const nextManifest: WeeklyResultsImportCommitManifest = { ...manifest, rollback: { resultIds, rolledBackAt: new Date().toISOString() } };
    await client.query(
      `UPDATE weekly_import_batches
          SET status = 'rolled_back', commit_manifest_jsonb = $2::jsonb, admin_actor = $3,
              rolled_back_at = now()
        WHERE id = $1`,
      [batch.id, JSON.stringify(nextManifest), input.actor]
    );
    await client.query("COMMIT");
    return await getWeeklyResultsImportBatch(batch.id, input.meetId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function normalizeForEvent(eventCode: string, values: Record<string, string>, sourceRow: number, context: ImportMeetContext) {
  const event = context.events.find((item) => item.eventCode === eventCode && item.enabled);
  const allAttempts = [values.attempt_1, values.attempt_2, values.attempt_3, values.attempt_4, values.attempt_5];
  const normalized = normalizeWeeklyResultRow({ eventCode, playerId: values.player_id, wcaId: values.wca_id, playerName: values.player_name, attemptValues: allAttempts.slice(0, event?.attemptCount || 5), notes: values.notes, sourceRow, format: event?.format || "avg5" });
  if (event && allAttempts.slice(event.attemptCount).some((value) => value.trim())) normalized.warnings.push(`该项目只读取前 ${event.attemptCount} 次尝试，后续单元格已忽略`);
  return normalized;
}

async function buildPreview(input: { context: ImportMeetContext; source: WeeklyResultsImportPreview["source"]; parser: WeeklyResultsImportPreview["parser"]; metadata: Record<string, string>; rows: NormalizedWeeklyResultRow[]; forcedPlayerIds?: Map<number, string>; globalWarnings?: string[]; globalErrors?: string[] }): Promise<WeeklyResultsImportPreview> {
  const { context } = input;
  const globalWarnings = input.globalWarnings ? [...input.globalWarnings] : [];
  const globalErrors = input.globalErrors ? [...input.globalErrors] : [];
  if (input.source === "xlsx") {
    if (input.metadata.meet_slug !== context.slug) globalErrors.push("比赛信息的 meet_slug 与当前周赛不一致，不能继续提交");
    if (String(input.metadata.week_number) !== String(context.weekNumber)) globalErrors.push("比赛信息的 week_number 与当前周赛不一致，不能继续提交");
    if (input.metadata.title !== context.title) globalWarnings.push("比赛信息 title 与当前周赛不同");
    if (input.metadata.start_date !== context.startDate || input.metadata.end_date !== context.endDate) globalWarnings.push("比赛信息日期与当前周赛不同");
  }
  const byId = new Map(context.players.map((player) => [player.id, player]));
  const byWcaId = groupBy(context.players.filter((player) => player.wcaId), (player) => player.wcaId.toUpperCase());
  const byName = groupBy(context.players, (player) => normalizeName(player.name));
  const events = new Map(context.events.map((event) => [event.eventCode, event]));
  const existingResults = await listExistingResults(context.id);
  const previewRows = input.rows.map((source) => {
    const row: WeeklyResultsImportPreviewRow = { ...source, warnings: [...source.warnings], errors: [...source.errors], candidates: [], recommendedPlayerId: "", handlingStatus: "unmatched", matchedPlayerName: "", matchedPlayerStatus: "", existingResult: false, duplicateExcelRow: false, bestText: formatResult(source.best), averageText: formatResult(source.average) };
    const event = events.get(row.eventCode);
    if (!event || !event.enabled) row.errors.push("event_code 不属于当前周赛已启用项目");
    if (event && row.attempts.length !== event.attemptCount && !row.errors.some((message) => message.includes("尝试"))) row.errors.push(`该项目要求 ${event.attemptCount} 次尝试`);
    if (!row.playerName && !row.playerId && !row.wcaId) row.errors.push("缺少 player_id、wca_id 和 player_name，无法匹配选手");
    const invalidPlayerId = Boolean(row.playerId && !byId.has(row.playerId));
    if (invalidPlayerId) row.errors.push("player_id 不存在，不能改用姓名或 WCA ID 自动关联");
    const match = buildWeeklyPlayerImportMatch({ name: row.playerName, gender: "", birthDate: "", playerId: invalidPlayerId ? "" : row.playerId, wcaId: invalidPlayerId ? "" : row.wcaId }, { byId, byWcaId, byName, players: context.players });
    row.candidates = match.candidates;
    row.recommendedPlayerId = match.recommendedPlayerId || "";
    row.matchStatus = match.type === "new" ? "unmatched" : match.type;
    const forced = input.forcedPlayerIds?.get(row.sourceRow);
    const selected = forced ? byId.get(forced) : (match.type === "player_id" || match.type === "wca_id" ? byId.get(match.recommendedPlayerId || "") : undefined);
    if (forced && !selected) row.errors.push("手动选择的选手不存在");
    if (selected) {
      row.matchedPlayerId = selected.id; row.matchedPlayerName = selected.name; row.matchedPlayerStatus = selected.status;
      row.handlingStatus = selected.status === "inactive" ? "blocked" : forced ? "exact" : "exact";
      if (forced) row.warnings.push(`已手动选择选手：${selected.name}`);
      if (selected.status === "inactive") { row.warnings.push("匹配到 inactive 选手"); row.errors.push("该选手已停用，不能作为新成绩提交对象"); }
      if (row.playerId && row.playerId === selected.id && row.wcaId && selected.wcaId && row.wcaId.toUpperCase() !== selected.wcaId.toUpperCase()) row.warnings.push("player_id 与 Excel WCA ID 不一致");
      if (row.playerId && row.playerId === selected.id && row.playerName && normalizeName(row.playerName) !== normalizeName(selected.name)) row.warnings.push("player_id 与 Excel 姓名不一致");
      row.existingResult = existingResults.has(`${row.eventCode}:${selected.id}`);
      if (row.existingResult) row.errors.push("已有成绩：该周赛、项目和选手组合已存在 result");
    } else if (match.type === "exact_name") {
      row.handlingStatus = "recommended";
      row.warnings.push("唯一姓名仅作为推荐，请人工确认后关联");
    } else if (match.type === "ambiguous_name" || match.type === "similar_name") {
      row.handlingStatus = "needs_resolution";
      row.warnings.push(match.type === "similar_name" ? "近似姓名候选，禁止自动关联" : row.wcaId && match.candidates.length > 1 ? "WCA ID 对应多个选手，必须人工选择" : "同名多人，必须人工选择");
    } else row.handlingStatus = "unmatched";
    return row;
  });
  const duplicates = groupBy(previewRows.filter((row) => row.matchedPlayerId).filter((row) => events.has(row.eventCode)), (row) => `${row.eventCode}:${row.matchedPlayerId}`);
  for (const group of duplicates.values()) if (group.length > 1) for (const row of group) { row.duplicateExcelRow = true; row.errors.push("Excel 中存在同一项目、同一选手的重复行"); }
  const validRows = previewRows.filter((row) => row.errors.length === 0 && Boolean(row.matchedPlayerId));
  const warnings = previewRows.reduce((total, row) => total + row.warnings.length, 0) + globalWarnings.length;
  const errors = previewRows.reduce((total, row) => total + row.errors.length, 0) + globalErrors.length;
  return { parser: input.parser, source: input.source, meetId: context.id, metadata: input.metadata, globalWarnings, globalErrors, rawRowCount: previewRows.length, validRowCount: globalErrors.length ? 0 : validRows.length, warningCount: warnings, errorCount: errors, exactPlayerIdMatchCount: previewRows.filter((row) => row.matchStatus === "player_id").length, wcaIdMatchCount: previewRows.filter((row) => row.matchStatus === "wca_id").length, nameRecommendationCount: previewRows.filter((row) => row.matchStatus === "exact_name").length, unmatchedCount: previewRows.filter((row) => row.matchStatus === "unmatched").length, conflictCount: previewRows.filter((row) => row.existingResult || row.duplicateExcelRow || row.warnings.some((message) => message.startsWith("player_id 与")) || row.errors.some((message) => message.startsWith("player_id 不存在"))).length, existingResultCount: previewRows.filter((row) => row.existingResult).length, rows: previewRows };
}

async function getImportContext(meetId: string): Promise<ImportMeetContext> {
  const pool = getPostgresPool();
  const [meetResult, eventResult, playerResult] = await Promise.all([
    pool.query<{ id: string; slug: string; week_number: number; title: string; starts_at: string | Date | null; ends_at: string | Date | null; data_version: number }>("SELECT id, slug, week_number, title, starts_at, ends_at, data_version FROM weekly_meets WHERE id = $1", [meetId]),
    pool.query<{ id: string; event_code: string; format: string; attempt_count: number; enabled: boolean }>("SELECT id, event_code, format, attempt_count, enabled FROM weekly_events WHERE meet_id = $1 AND event_code IS NOT NULL AND event_code <> ''", [meetId]),
    pool.query<{ id: string; name: string; wca_id: string; gender: string; birth_date: string; province: string; city: string; status: string }>(`SELECT id, name, wca_id, gender, birth_date, province, city, status FROM weekly_player_library WHERE ${weeklyV2ActivePlayerSql()}`)
  ]);
  const meet = meetResult.rows[0]; if (!meet) throw new Error("周赛不存在");
  if (meet.data_version !== 2) throw new Error("历史数据 / 只读");
  return { id: meet.id, slug: meet.slug, weekNumber: meet.week_number, title: meet.title, startDate: toIsoDate(meet.starts_at), endDate: toIsoDate(meet.ends_at), events: eventResult.rows.map((row) => ({ id: row.id, eventCode: row.event_code, format: getWeeklyResultFormat(row.format).id, attemptCount: row.attempt_count, enabled: row.enabled })), players: playerResult.rows.map((row) => ({ id: row.id, name: row.name, wcaId: row.wca_id || "", gender: row.gender === "女" ? "女" : row.gender === "男" ? "男" : "", birthDate: row.birth_date || "", province: row.province || "", city: row.city || "", status: row.status === "inactive" ? "inactive" : "active" })) };
}
async function listExistingResults(meetId: string) { const pool = getPostgresPool(); const { rows } = await pool.query<{ event_code: string; player_id: string }>(`SELECT we.event_code, wr.player_id FROM weekly_results wr JOIN weekly_events we ON we.id = wr.event_id WHERE wr.meet_id = $1 AND wr.player_id IS NOT NULL`, [meetId]); return new Set(rows.map((row) => `${row.event_code}:${row.player_id}`)); }
function parsePreview(value: unknown) { if (!value || typeof value !== "object") throw new Error("导入批次预览数据不正确"); return value as WeeklyResultsImportPreview; }
function parseManifest(value: unknown): WeeklyResultsImportCommitManifest { return value && typeof value === "object" ? value as WeeklyResultsImportCommitManifest : {}; }
function mapBatch(row: BatchRow): WeeklyResultsImportBatch {
  return {
    id: row.id,
    kind: "results",
    filename: row.filename,
    status: row.status,
    rawRowCount: Number(row.raw_row_count),
    validRowCount: Number(row.valid_row_count),
    warningCount: Number(row.warning_count),
    errorCount: Number(row.error_count),
    preview: parsePreview(row.preview_jsonb),
    commitManifest: parseManifest(row.commit_manifest_jsonb),
    createdAt: row.created_at,
    committedAt: row.committed_at,
    rolledBackAt: row.rolled_back_at
  };
}

function assertReadyPreview(preview: WeeklyResultsImportPreview, batch: BatchRow) {
  if (preview.globalErrors.length || preview.errorCount || Number(batch.error_count) || preview.rawRowCount === 0 || preview.validRowCount !== preview.rawRowCount || preview.rows.length !== preview.rawRowCount) {
    throw new Error("预览不是完整无错误的 ready 批次，请处理所有冲突后重新生成预览");
  }
  for (const row of preview.rows) {
    if (row.errors.length || !row.matchedPlayerId) throw new Error(`第 ${row.sourceRow} 行仍未完成校验或没有正式 player_id`);
  }
}

async function insertImportedAttempts(client: PoolClient, resultId: number, attempts: ResultValue[]) {
  for (const [index, attempt] of attempts.entries()) {
    const status = typeof attempt === "number" ? "ok" : attempt.toLowerCase();
    // value is retained solely for legacy reads. New import authority is the
    // (value_centiseconds, status) pair, so no Excel-derived result summary is stored here.
    await client.query(
      `INSERT INTO weekly_attempts (result_id, seq, value, value_centiseconds, status)
       VALUES ($1,$2,NULL,$3,$4)`,
      [resultId, index + 1, typeof attempt === "number" ? attempt : null, status]
    );
  }
}

function personalBestKey(eventCode: string) { return eventCode === "individual" ? "allAround" : eventCode; }
function storedPositiveValue(value: unknown) { const numeric = Number(value); return Number.isFinite(numeric) && numeric > 0 ? numeric : null; }
function groupBy<T>(items: T[], key: (item: T) => string) { const result = new Map<string, T[]>(); for (const item of items) { const group = result.get(key(item)) || []; group.push(item); result.set(key(item), group); } return result; }
function normalizeName(value: string) { return value.normalize("NFKC").replace(/\s+/g, "").trim(); }
function sanitizeFilename(value: string) { return value.replace(/[\\/\0]/g, "_").slice(0, 180) || "weekly-results.xlsx"; }
function toIsoDate(value: string | Date | null) { return value ? (typeof value === "string" ? value : value.toISOString()).slice(0, 10) : ""; }
