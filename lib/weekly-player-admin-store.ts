import { createHash, randomUUID } from "node:crypto";
import { getPostgresPool } from "@/lib/postgres";
import {
  createLibraryPlayerId,
  type WeeklyLibraryGender,
  type WeeklyPlayerLibraryEntry
} from "@/lib/weekly-player-library";
import {
  parseLiaoningPlayerLibraryWorkbook,
  type WeeklyImportPlayerCandidate,
  type WeeklyPlayerImportPreview,
  type WeeklyPlayerImportPreviewRow
} from "@/lib/weekly-player-import";
import type { PoolClient } from "pg";
import { isWeeklyV2ActivePlayer, weeklyV2ActivePlayerSql, weeklyV2PlayerSourceSql } from "@/lib/weekly-player-scope";

export type WeeklyPlayerAdminListItem = WeeklyPlayerLibraryEntry & {
  resultCount: number;
  lastCompetedAt: string | null;
  createdAt: string;
  longCardProfile: WeeklyLongCardProfile | null;
};

export type WeeklyLongCardProfile = {
  sourceRowNumber: number;
  submittedAt: string;
  name: string;
  gender: string;
  birthDate: string;
  phone: string;
  contactRelationship: string;
  channel: string;
  notes: string;
  wcaId: string;
  matchedPlayerId: string | null;
};

export type WeeklyPlayerAdminList = {
  players: WeeklyPlayerAdminListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type WeeklyImportBatch = {
  id: string;
  kind: "players";
  filename: string;
  fileSha256: string;
  status: "parsed" | "needs_review" | "ready" | "committed" | "failed" | "rolled_back";
  rawRowCount: number;
  validRowCount: number;
  warningCount: number;
  errorCount: number;
  preview: WeeklyPlayerImportPreview;
  commitManifest: WeeklyImportCommitManifest;
  adminActor: string;
  createdAt: string;
  committedAt: string | null;
  rolledBackAt: string | null;
};

export type WeeklyImportResolution = {
  rowNumber: number;
  action?: "create" | "link";
  playerId?: string;
  conflictChoices?: Partial<Record<"gender" | "birthDate", "keep_existing" | "use_excel">>;
};

type WeeklyImportCommitManifest = {
  createdPlayerIds?: string[];
  updatedPlayers?: {
    id: string;
    before: PlayerSnapshot;
    after: PlayerSnapshot;
  }[];
  rollback?: {
    deletedPlayerIds: string[];
    inactivatedPlayerIds: string[];
    restoredPlayerIds: string[];
  };
};

type PlayerSnapshot = {
  name: string;
  gender: WeeklyLibraryGender;
  birthDate: string;
  wcaId: string;
  province: string;
  city: string;
  notes: string;
  status: "active" | "inactive";
  deactivatedAt: string | null;
  deactivationReason: string;
  source: string;
};

type PlayerRow = {
  id: string;
  name: string;
  gender: string;
  birth_date: string;
  wca_id: string;
  province: string;
  city: string;
  notes: string;
  status: string;
  deactivated_at: string | null;
  deactivation_reason: string;
  source: string;
  created_at: string;
  updated_at: string;
  result_count?: string;
  last_competed_at?: string | null;
  long_card_source_row_number?: number | null;
  long_card_submitted_at?: string | null;
  long_card_name?: string | null;
  long_card_gender?: string | null;
  long_card_birth_date?: string | null;
  long_card_phone?: string | null;
  long_card_contact_relationship?: string | null;
  long_card_channel?: string | null;
  long_card_notes?: string | null;
  long_card_matched_player_id?: string | null;
};

const pageSize = 50;

export async function listWeeklyPlayersForAdmin(input: {
  query?: string;
  status?: "active" | "inactive" | "all";
  gender?: WeeklyLibraryGender | "all";
  page?: number;
} = {}): Promise<WeeklyPlayerAdminList> {
  const query = input.query?.trim() || "";
  const status = input.status === "inactive" ? "inactive" : input.status === "active" ? "active" : "all";
  const gender = input.gender === "男" || input.gender === "女" || input.gender === "" ? input.gender : "all";
  const page = Math.max(1, Math.floor(input.page || 1));
  const filters: string[] = [weeklyV2PlayerSourceSql("wpl")];
  const params: unknown[] = [];
  if (query) {
    params.push(`%${query}%`);
    filters.push(`(wpl.name ILIKE $${params.length} OR wpl.wca_id ILIKE $${params.length} OR wpl.province ILIKE $${params.length} OR wpl.city ILIKE $${params.length})`);
  }
  if (status !== "all") {
    params.push(status);
    filters.push(`wpl.status = $${params.length}`);
  }
  if (gender !== "all") {
    params.push(gender);
    filters.push(`wpl.gender = $${params.length}`);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const pool = getPostgresPool();
  const countResult = await pool.query<{ total: string }>(`SELECT count(*)::text AS total FROM weekly_player_library wpl ${where}`, params);
  params.push(pageSize, (page - 1) * pageSize);
  const { rows } = await pool.query<PlayerRow>(
    `WITH selected_players AS (
       SELECT wpl.id, wpl.name, wpl.gender, wpl.birth_date, wpl.wca_id, wpl.province, wpl.city,
              wpl.notes, wpl.status, wpl.deactivated_at, wpl.deactivation_reason, wpl.source,
              wpl.created_at, wpl.updated_at
         FROM weekly_player_library wpl
         ${where}
        ORDER BY wpl.status, wpl.name, wpl.id
        LIMIT $${params.length - 1} OFFSET $${params.length}
     ), result_stats AS (
       SELECT wr.player_id, COUNT(wr.id)::text AS result_count, MAX(wm.starts_at) AS last_competed_at
         FROM weekly_results wr
         JOIN selected_players player ON player.id = wr.player_id
         LEFT JOIN weekly_meets wm ON wm.id = wr.meet_id
        GROUP BY wr.player_id
     )
     SELECT player.id, player.name, player.gender, player.birth_date, player.wca_id, player.province, player.city,
            player.notes, player.status, player.deactivated_at, player.deactivation_reason, player.source,
            player.created_at, player.updated_at,
            COALESCE(result_stats.result_count, '0') AS result_count, result_stats.last_competed_at,
            long_card.source_row_number AS long_card_source_row_number,
            long_card.submitted_at AS long_card_submitted_at,
            long_card.student_name AS long_card_name,
            long_card.gender AS long_card_gender,
            long_card.birth_date AS long_card_birth_date,
            long_card.phone AS long_card_phone,
            long_card.contact_relationship AS long_card_contact_relationship,
            long_card.channel AS long_card_channel,
            long_card.source_notes AS long_card_notes,
            long_card.matched_player_id AS long_card_matched_player_id
       FROM selected_players player
       LEFT JOIN result_stats ON result_stats.player_id = player.id
       LEFT JOIN LATERAL (
         SELECT source_row_number, submitted_at, student_name, gender, birth_date, phone,
                contact_relationship, channel, source_notes, matched_player_id
           FROM weekly_long_card_profiles
          WHERE matched_player_id = player.id
          ORDER BY submitted_at DESC, source_row_number DESC
          LIMIT 1
       ) long_card ON TRUE
      ORDER BY player.status, player.name, player.id`,
    params
  );
  return {
    players: rows.map(mapAdminPlayer),
    total: Number(countResult.rows[0]?.total || 0),
    page,
    pageSize
  };
}

export async function listWeeklyLongCardProfilesForAdmin(): Promise<WeeklyLongCardProfile[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<{
    source_row_number: number; submitted_at: string; student_name: string; gender: string; birth_date: string;
    phone: string; contact_relationship: string; channel: string; source_notes: string; wca_id: string; matched_player_id: string | null;
  }>(`SELECT source_row_number, submitted_at, student_name, gender, birth_date, phone,
             contact_relationship, channel, source_notes, wca_id, matched_player_id
        FROM weekly_long_card_profiles
       ORDER BY source_row_number`);
  return rows.map((row) => ({
    sourceRowNumber: row.source_row_number,
    submittedAt: row.submitted_at || "",
    name: row.student_name,
    gender: row.gender || "",
    birthDate: row.birth_date || "",
    phone: row.phone || "",
    contactRelationship: row.contact_relationship || "",
    channel: row.channel || "",
    notes: row.source_notes || "",
    wcaId: row.wca_id || "",
    matchedPlayerId: row.matched_player_id
  }));
}

export async function updateWeeklyLongCardProfile(sourceRowNumber: number, input: Partial<WeeklyLongCardProfile>) {
  if (!Number.isInteger(sourceRowNumber) || sourceRowNumber < 1) throw new Error("长期卡资料不存在");
  const pool = getPostgresPool();
  const current = await pool.query<{
    source_row_number: number; submitted_at: string; student_name: string; gender: string; birth_date: string;
    phone: string; contact_relationship: string; channel: string; source_notes: string; wca_id: string; matched_player_id: string | null;
  }>(`SELECT source_row_number, submitted_at, student_name, gender, birth_date, phone,
             contact_relationship, channel, source_notes, wca_id, matched_player_id
        FROM weekly_long_card_profiles
       WHERE source_row_number = $1`, [sourceRowNumber]);
  const profile = current.rows[0];
  if (!profile) throw new Error("长期卡资料不存在");
  const submittedAt = input.submittedAt === undefined ? profile.submitted_at : normalizeOptionalDate(input.submittedAt, "提交日期");
  const birthDate = input.birthDate === undefined ? profile.birth_date : normalizeOptionalDate(input.birthDate, "出生日期");
  const { rows } = await pool.query<typeof profile>(
    `UPDATE weekly_long_card_profiles
        SET submitted_at = $2, student_name = $3, gender = $4, birth_date = $5, phone = $6,
            contact_relationship = $7, channel = $8, source_notes = $9, wca_id = $10, updated_at = now()
      WHERE source_row_number = $1
      RETURNING source_row_number, submitted_at, student_name, gender, birth_date, phone,
                contact_relationship, channel, source_notes, wca_id, matched_player_id`,
    [
      sourceRowNumber,
      submittedAt,
      input.name === undefined ? profile.student_name : input.name.trim(),
      input.gender === undefined ? profile.gender : normalizeGender(input.gender),
      birthDate,
      input.phone === undefined ? profile.phone : input.phone.trim(),
      input.contactRelationship === undefined ? profile.contact_relationship : input.contactRelationship.trim(),
      input.channel === undefined ? profile.channel : input.channel.trim(),
      input.notes === undefined ? profile.source_notes : input.notes.trim(),
      input.wcaId === undefined ? profile.wca_id : input.wcaId.trim().toUpperCase()
    ]
  );
  const row = rows[0];
  return {
    sourceRowNumber: row.source_row_number, submittedAt: row.submitted_at || "", name: row.student_name,
    gender: row.gender || "", birthDate: row.birth_date || "", phone: row.phone || "",
    contactRelationship: row.contact_relationship || "", channel: row.channel || "",
    notes: row.source_notes || "", wcaId: row.wca_id || "", matchedPlayerId: row.matched_player_id
  } satisfies WeeklyLongCardProfile;
}

export async function createWeeklyPlayerProfile(input: Partial<WeeklyPlayerLibraryEntry> & { confirmSameName?: boolean }) {
  const name = input.name?.trim() || "";
  if (!name) throw new Error("姓名必填");
  const wcaId = input.wcaId?.trim().toUpperCase() || "";
  const pool = getPostgresPool();
  await assertWcaIdAvailable(pool, wcaId);
  const sameName = await pool.query<{ id: string; name: string }>(`SELECT id, name FROM weekly_player_library WHERE name = $1 AND ${weeklyV2PlayerSourceSql()} ORDER BY id LIMIT 10`, [name]);
  if (sameName.rows.length > 0 && !input.confirmSameName) {
    throw new Error(`已有 ${sameName.rows.length} 名同名选手。请确认后再创建新的独立档案。`);
  }
  const { rows } = await pool.query<PlayerRow>(
    `INSERT INTO weekly_player_library
       (id, name, gender, birth_date, wca_id, province, city, notes, status, source, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active','admin_manual',now())
     RETURNING id, name, gender, birth_date, wca_id, province, city, notes, status,
               deactivated_at, deactivation_reason, source, created_at, updated_at`,
    [
      createLibraryPlayerId(),
      name,
      normalizeGender(input.gender),
      normalizeDate(input.birthDate),
      wcaId,
      input.province?.trim() || "",
      input.city?.trim() || "",
      input.notes?.trim() || ""
    ]
  );
  return { player: mapAdminPlayer(rows[0]), sameNameCandidates: sameName.rows };
}

export async function updateWeeklyPlayerProfile(id: string, input: Partial<WeeklyPlayerLibraryEntry>) {
  const pool = getPostgresPool();
  const current = await pool.query<PlayerRow>(
    `SELECT id, name, gender, birth_date, wca_id, province, city, notes, status,
            deactivated_at, deactivation_reason, source, created_at, updated_at
       FROM weekly_player_library WHERE id = $1 AND ${weeklyV2PlayerSourceSql()}`,
    [id]
  );
  const player = current.rows[0];
  if (!player) throw new Error("选手不存在");
  const nextWcaId = input.wcaId === undefined ? player.wca_id : input.wcaId.trim().toUpperCase();
  await assertWcaIdAvailable(pool, nextWcaId, player.id);
  const nextStatus = input.status === "inactive" ? "inactive" : input.status === "active" ? "active" : player.status;
  const nextDeactivatedAt = nextStatus === "inactive" ? input.deactivatedAt ?? player.deactivated_at ?? new Date().toISOString() : null;
  const nextDeactivationReason = nextStatus === "inactive" ? input.deactivationReason?.trim() ?? player.deactivation_reason : "";
  if (nextStatus === "inactive" && !nextDeactivationReason) throw new Error("停用选手时请填写停用原因");
  const { rows } = await pool.query<PlayerRow>(
    `UPDATE weekly_player_library
        SET name = $2, gender = $3, birth_date = $4, wca_id = $5, province = $6, city = $7,
            notes = $8, status = $9, deactivated_at = $10, deactivation_reason = $11, updated_at = now()
      WHERE id = $1 AND ${weeklyV2PlayerSourceSql()}
      RETURNING id, name, gender, birth_date, wca_id, province, city, notes, status,
                deactivated_at, deactivation_reason, source, created_at, updated_at`,
    [
      player.id,
      input.name?.trim() || player.name,
      input.gender === undefined ? player.gender : normalizeGender(input.gender),
      input.birthDate === undefined ? player.birth_date : normalizeDate(input.birthDate),
      nextWcaId,
      input.province === undefined ? player.province : input.province.trim(),
      input.city === undefined ? player.city : input.city.trim(),
      input.notes === undefined ? player.notes : input.notes.trim(),
      nextStatus,
      nextDeactivatedAt,
      nextDeactivationReason
    ]
  );
  return mapAdminPlayer(rows[0]);
}

export async function createPlayerImportPreview(input: { filename: string; buffer: Buffer; actor: string }) {
  const hash = createHash("sha256").update(input.buffer).digest("hex");
  const pool = getPostgresPool();
  const duplicate = await pool.query<{ id: string; filename: string; committed_at: string | null }>(
    `SELECT id, filename, committed_at FROM weekly_import_batches
      WHERE kind = 'players' AND file_sha256 = $1 AND status = 'committed'
      ORDER BY committed_at DESC LIMIT 1`,
    [hash]
  );
  if (duplicate.rows[0]) {
    return { duplicate: duplicate.rows[0], batch: null };
  }
  const candidates = await listImportCandidates(pool);
  const preview = await parseLiaoningPlayerLibraryWorkbook(input.buffer, candidates);
  const requiresReview = preview.rows.some((row) =>
    Boolean(row.match.recommendedPlayerId) || row.match.fieldConflicts.length > 0 ||
    row.match.type === "ambiguous_name" || row.match.type === "similar_name"
  );
  const status = preview.errorCount > 0 || requiresReview ? "needs_review" : "ready";
  const id = `weekly-import-${randomUUID()}`;
  const { rows } = await pool.query<BatchRow>(
    `INSERT INTO weekly_import_batches
       (id, kind, filename, file_sha256, status, raw_row_count, valid_row_count, warning_count, error_count,
        preview_jsonb, commit_manifest_jsonb, admin_actor)
     VALUES ($1,'players',$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'{}'::jsonb,$10)
     RETURNING *`,
    [id, sanitizeFilename(input.filename), hash, status, preview.rawRowCount, preview.validRowCount, preview.warningCount, preview.errorCount, JSON.stringify(preview), input.actor]
  );
  return { duplicate: null, batch: mapBatch(rows[0]) };
}

export async function listPlayerImportBatches() {
  const pool = getPostgresPool();
  const { rows } = await pool.query<BatchRow>("SELECT * FROM weekly_import_batches WHERE kind = 'players' ORDER BY created_at DESC LIMIT 30");
  return rows.map(mapBatch);
}

export async function getPlayerImportBatch(id: string) {
  const pool = getPostgresPool();
  const { rows } = await pool.query<BatchRow>("SELECT * FROM weekly_import_batches WHERE id = $1 AND kind = 'players'", [id]);
  return rows[0] ? mapBatch(rows[0]) : null;
}

export async function commitPlayerImportBatch(input: { id: string; resolutions: WeeklyImportResolution[]; actor: string }) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const batchResult = await client.query<BatchRow>("SELECT * FROM weekly_import_batches WHERE id = $1 AND kind = 'players' FOR UPDATE", [input.id]);
    const batch = batchResult.rows[0];
    if (!batch) throw new Error("导入批次不存在");
    if (batch.status === "committed") throw new Error("该批次已经提交");
    if (batch.status === "rolled_back") throw new Error("已回滚的批次不能再次提交");
    const duplicate = await client.query<{ id: string }>(
      "SELECT id FROM weekly_import_batches WHERE kind = 'players' AND file_sha256 = $1 AND status = 'committed' AND id <> $2 LIMIT 1",
      [batch.file_sha256, batch.id]
    );
    if (duplicate.rows[0]) throw new Error("该文件已经成功导入，不能重复提交");
    const preview = parsePreview(batch.preview_jsonb);
    const resolutionByRow = new Map(input.resolutions.map((resolution) => [resolution.rowNumber, resolution]));
    const manifest: WeeklyImportCommitManifest = { createdPlayerIds: [], updatedPlayers: [] };

    for (const row of preview.rows) {
      if (row.errors.length > 0) continue;
      const resolution = resolutionByRow.get(row.rowNumber);
      const selectedId = resolveSelectedPlayerId(row, resolution);
      if (selectedId) {
        const target = await getPlayerForUpdate(client, selectedId);
        if (!target) throw new Error(`第 ${row.rowNumber} 行关联的选手不存在`);
        if (!isWeeklyV2ActivePlayer(target)) throw new Error(`第 ${row.rowNumber} 行关联的选手不属于 weekly v2 active 范围`);
        const next = mergeImportedPlayer(target, row, resolution);
        if (!sameSnapshot(snapshotPlayer(target), next)) {
          await client.query(
            `UPDATE weekly_player_library
                SET gender = $2, birth_date = $3, updated_at = now()
              WHERE id = $1`,
            [target.id, next.gender, next.birthDate]
          );
          manifest.updatedPlayers!.push({ id: target.id, before: snapshotPlayer(target), after: next });
        }
      } else {
        const id = createLibraryPlayerId();
        await client.query(
          `INSERT INTO weekly_player_library
             (id, name, gender, birth_date, wca_id, province, city, notes, status, source, updated_at)
           VALUES ($1,$2,$3,$4,'','','','', 'active', 'players_excel_import', now())`,
          [id, row.name, row.gender, row.birthDate]
        );
        manifest.createdPlayerIds!.push(id);
      }
    }

    await client.query(
      `UPDATE weekly_import_batches
          SET status = 'committed', commit_manifest_jsonb = $2::jsonb, admin_actor = $3, committed_at = now()
        WHERE id = $1`,
      [batch.id, JSON.stringify(manifest), input.actor]
    );
    await client.query("COMMIT");
    return getPlayerImportBatch(batch.id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function rollbackPlayerImportBatch(input: { id: string; actor: string }) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const batchResult = await client.query<BatchRow>("SELECT * FROM weekly_import_batches WHERE id = $1 AND kind = 'players' FOR UPDATE", [input.id]);
    const batch = batchResult.rows[0];
    if (!batch) throw new Error("导入批次不存在");
    if (batch.status !== "committed") throw new Error("只有已提交批次可以回滚");
    const manifest = parseManifest(batch.commit_manifest_jsonb);
    const rollback = { deletedPlayerIds: [] as string[], inactivatedPlayerIds: [] as string[], restoredPlayerIds: [] as string[] };
    for (const id of manifest.createdPlayerIds || []) {
      const resultCount = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM weekly_results WHERE player_id = $1", [id]);
      if (Number(resultCount.rows[0]?.count || 0) === 0) {
        await client.query("DELETE FROM weekly_player_library WHERE id = $1", [id]);
        rollback.deletedPlayerIds.push(id);
      } else {
        await client.query(
          `UPDATE weekly_player_library
              SET status = 'inactive', deactivated_at = now(), deactivation_reason = $2, updated_at = now()
            WHERE id = $1`,
          [id, `回滚批次 ${batch.id}：已有比赛成绩，保留档案`]
        );
        rollback.inactivatedPlayerIds.push(id);
      }
    }
    for (const update of manifest.updatedPlayers || []) {
      await restoreSnapshot(client, update.id, update.before);
      rollback.restoredPlayerIds.push(update.id);
    }
    const nextManifest = { ...manifest, rollback };
    await client.query(
      `UPDATE weekly_import_batches
          SET status = 'rolled_back', commit_manifest_jsonb = $2::jsonb, admin_actor = $3, rolled_back_at = now()
        WHERE id = $1`,
      [batch.id, JSON.stringify(nextManifest), input.actor]
    );
    await client.query("COMMIT");
    return getPlayerImportBatch(batch.id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

type BatchRow = {
  id: string;
  kind: "players";
  filename: string;
  file_sha256: string;
  status: WeeklyImportBatch["status"];
  raw_row_count: number;
  valid_row_count: number;
  warning_count: number;
  error_count: number;
  preview_jsonb: unknown;
  commit_manifest_jsonb: unknown;
  admin_actor: string;
  created_at: string;
  committed_at: string | null;
  rolled_back_at: string | null;
};

function mapAdminPlayer(row: PlayerRow): WeeklyPlayerAdminListItem {
  return {
    id: row.id,
    name: row.name,
    wcaId: row.wca_id,
    gender: normalizeGender(row.gender),
    birthDate: row.birth_date,
    province: row.province,
    city: row.city,
    notes: row.notes,
    status: row.status === "inactive" ? "inactive" : "active",
    deactivatedAt: row.deactivated_at,
    deactivationReason: row.deactivation_reason,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resultCount: Number(row.result_count || 0),
    lastCompetedAt: row.last_competed_at || null,
    longCardProfile: row.long_card_source_row_number ? {
      sourceRowNumber: row.long_card_source_row_number,
      submittedAt: row.long_card_submitted_at || "",
      name: row.long_card_name || "",
      gender: row.long_card_gender || "",
      birthDate: row.long_card_birth_date || "",
      phone: row.long_card_phone || "",
      contactRelationship: row.long_card_contact_relationship || "",
      channel: row.long_card_channel || "",
      notes: row.long_card_notes || "",
      wcaId: "",
      matchedPlayerId: row.long_card_matched_player_id || null
    } : null
  };
}

function mapBatch(row: BatchRow): WeeklyImportBatch {
  return {
    id: row.id,
    kind: "players",
    filename: row.filename,
    fileSha256: row.file_sha256,
    status: row.status,
    rawRowCount: Number(row.raw_row_count),
    validRowCount: Number(row.valid_row_count),
    warningCount: Number(row.warning_count),
    errorCount: Number(row.error_count),
    preview: parsePreview(row.preview_jsonb),
    commitManifest: parseManifest(row.commit_manifest_jsonb),
    adminActor: row.admin_actor,
    createdAt: row.created_at,
    committedAt: row.committed_at,
    rolledBackAt: row.rolled_back_at
  };
}

async function listImportCandidates(client: Pick<PoolClient, "query">) {
  const { rows } = await client.query<PlayerRow>(
    `SELECT id, name, gender, birth_date, wca_id, province, city, notes, status,
            deactivated_at, deactivation_reason, source, created_at, updated_at
       FROM weekly_player_library
      WHERE ${weeklyV2ActivePlayerSql()}`
  );
  return rows.map((row): WeeklyImportPlayerCandidate => ({
    id: row.id,
    name: row.name,
    wcaId: row.wca_id,
    gender: normalizeGender(row.gender),
    birthDate: row.birth_date,
    province: row.province,
    city: row.city,
    status: row.status === "inactive" ? "inactive" : "active"
  }));
}

async function getPlayerForUpdate(client: PoolClient, id: string) {
  const { rows } = await client.query<PlayerRow>(
    `SELECT id, name, gender, birth_date, wca_id, province, city, notes, status,
            deactivated_at, deactivation_reason, source, created_at, updated_at
       FROM weekly_player_library WHERE id = $1 AND ${weeklyV2ActivePlayerSql()} FOR UPDATE`,
    [id]
  );
  return rows[0] || null;
}

function resolveSelectedPlayerId(row: WeeklyPlayerImportPreviewRow, resolution?: WeeklyImportResolution) {
  // Recommendations are never acceptance. This includes a unique same-name
  // match: importing it must not silently merge two people.
  if ((row.match.recommendedPlayerId || row.match.type === "ambiguous_name" || row.match.type === "similar_name") && !resolution?.action) {
    throw new Error(`第 ${row.rowNumber} 行存在候选选手，必须明确选择关联对象或新建`);
  }
  const action = resolution?.action || "create";
  if (action === "create") return "";
  const playerId = resolution?.playerId || row.match.recommendedPlayerId || "";
  const allowed = new Set(row.match.candidates.map((candidate) => candidate.id));
  if (!playerId || !allowed.has(playerId)) throw new Error(`第 ${row.rowNumber} 行需要选择有效的关联选手，或明确选择新建`);
  if ((row.match.type === "ambiguous_name" || row.match.type === "similar_name") && !resolution?.playerId) throw new Error(`第 ${row.rowNumber} 行存在候选选手，必须人工选择关联对象或新建`);
  return playerId;
}

function mergeImportedPlayer(player: PlayerRow, row: WeeklyPlayerImportPreviewRow, resolution?: WeeklyImportResolution): PlayerSnapshot {
  const before = snapshotPlayer(player);
  const hasGenderConflict = Boolean(row.gender && before.gender && row.gender !== before.gender);
  const hasBirthDateConflict = Boolean(row.birthDate && before.birthDate && row.birthDate !== before.birthDate);
  if (hasGenderConflict && !resolution?.conflictChoices?.gender) throw new Error(`第 ${row.rowNumber} 行性别冲突，必须明确选择保留值`);
  if (hasBirthDateConflict && !resolution?.conflictChoices?.birthDate) throw new Error(`第 ${row.rowNumber} 行生日冲突，必须明确选择保留值`);
  const genderChoice = resolution?.conflictChoices?.gender || "keep_existing";
  const birthChoice = resolution?.conflictChoices?.birthDate || "keep_existing";
  return {
    ...before,
    gender: row.gender && (!before.gender || (row.gender !== before.gender && genderChoice === "use_excel")) ? row.gender : before.gender,
    birthDate: row.birthDate && (!before.birthDate || (row.birthDate !== before.birthDate && birthChoice === "use_excel")) ? row.birthDate : before.birthDate
  };
}

function snapshotPlayer(row: PlayerRow): PlayerSnapshot {
  return {
    name: row.name,
    gender: normalizeGender(row.gender),
    birthDate: row.birth_date || "",
    wcaId: row.wca_id || "",
    province: row.province || "",
    city: row.city || "",
    notes: row.notes || "",
    status: row.status === "inactive" ? "inactive" : "active",
    deactivatedAt: row.deactivated_at,
    deactivationReason: row.deactivation_reason || "",
    source: row.source || ""
  };
}

function sameSnapshot(left: PlayerSnapshot, right: PlayerSnapshot) {
  return left.gender === right.gender && left.birthDate === right.birthDate;
}

async function restoreSnapshot(client: PoolClient, id: string, value: PlayerSnapshot) {
  await client.query(
    `UPDATE weekly_player_library
        SET name = $2, gender = $3, birth_date = $4, wca_id = $5, province = $6, city = $7,
            notes = $8, status = $9, deactivated_at = $10, deactivation_reason = $11,
            source = $12, updated_at = now()
      WHERE id = $1`,
    [id, value.name, value.gender, value.birthDate, value.wcaId, value.province, value.city, value.notes, value.status, value.deactivatedAt, value.deactivationReason, value.source]
  );
}

async function assertWcaIdAvailable(client: Pick<PoolClient, "query"> | ReturnType<typeof getPostgresPool>, wcaId: string, excludeId = "") {
  if (!wcaId) return;
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM weekly_player_library WHERE upper(wca_id) = $1 AND id <> $2 AND ${weeklyV2PlayerSourceSql()} LIMIT 2`,
    [wcaId.toUpperCase(), excludeId]
  );
  if (rows.length > 0) throw new Error("该 WCA ID 已存在或历史数据中存在重复，不能重复绑定");
}

function normalizeGender(value: unknown): WeeklyLibraryGender {
  return value === "男" || value === "女" ? value : "";
}

function normalizeDate(value: string | undefined) {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("出生日期必须是完整有效日期");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error("出生日期无效");
  return value;
}

function normalizeOptionalDate(value: string, label: string) {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label}必须是完整有效日期`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(`${label}无效`);
  return value;
}

function sanitizeFilename(value: string) {
  return value.replace(/[\\/\0]/g, "_").slice(0, 255) || "players.xlsx";
}

function parsePreview(value: unknown): WeeklyPlayerImportPreview {
  if (!value || typeof value !== "object") throw new Error("导入预览数据损坏");
  return value as WeeklyPlayerImportPreview;
}

function parseManifest(value: unknown): WeeklyImportCommitManifest {
  return value && typeof value === "object" ? value as WeeklyImportCommitManifest : {};
}
