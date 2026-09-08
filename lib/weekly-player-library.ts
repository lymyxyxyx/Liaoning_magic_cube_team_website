import { getPostgresPool } from "@/lib/postgres";
import { enrichLocalProfiles, readLocalProfiles } from "@/lib/local-profile-store";
import { getWeeklyAgeGroup, weeklyAgeGroups } from "@/lib/weekly-age-groups";
import { randomUUID } from "node:crypto";
import { isWeeklyV2ActivePlayer, weeklyV2ActivePlayerSql, weeklyV2PlayerSourceSql } from "@/lib/weekly-player-scope";

export type WeeklyLibraryGender = "" | "男" | "女";
export type WeeklyPersonalBests = Partial<Record<"333" | "222" | "pyram" | "mirror" | "maple" | "skewb" | "allAround", number>>;

export type WeeklyPlayerLibraryEntry = {
  id: string;
  name: string;
  wcaId?: string;
  wcaIdConfirmed?: boolean;
  gender: WeeklyLibraryGender;
  birthDate: string;
  ageGroup?: string;
  ageGroupIsFuzzy?: boolean;
  province: string;
  city: string;
  source: string;
  notes?: string;
  status?: "active" | "inactive";
  deactivatedAt?: string | null;
  deactivationReason?: string;
  personalBests?: WeeklyPersonalBests;
  personalBestAverages?: WeeklyPersonalBests;
  createdAt?: string;
  updatedAt?: string;
};

export type WeeklyWcaMatchCandidate = {
  id: number;
  weeklyPlayerId: string;
  wcaId: string;
  wcaName: string;
  gender: WeeklyLibraryGender;
  province: string;
  city: string;
  score: number;
  method: "exact_name" | "name_city" | "name_gender" | "name_city_gender";
  evidence: string[];
  status: "suggested" | "confirmed" | "rejected";
  confirmedAt?: string | null;
  updatedAt?: string;
};

type WeeklyPlayerLibraryRow = {
  id: string;
  name: string;
  wca_id: string;
  wca_id_confirmed: boolean;
  gender: string;
  birth_date: string;
  age_group_override: string;
  age_group_is_fuzzy: boolean;
  province: string;
  city: string;
  source: string;
  notes: string;
  status: string;
  deactivated_at: string | null;
  deactivation_reason: string;
  personal_bests: WeeklyPersonalBests | null;
  personal_bests_average: WeeklyPersonalBests | null;
  updated_at: string;
};

type WeeklyWcaMatchRow = {
  id: number;
  weekly_player_id: string;
  wca_id: string;
  wca_name: string;
  gender: string;
  province: string;
  city: string;
  score: number;
  method: string;
  evidence: string[] | null;
  status: string;
  confirmed_at: string | null;
  updated_at: string;
};

export async function listWeeklyPlayerLibrary(): Promise<WeeklyPlayerLibraryEntry[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<WeeklyPlayerLibraryRow>(
    `SELECT id, name, wca_id, wca_id_confirmed, gender, birth_date, age_group_override, age_group_is_fuzzy,
            province, city, source, notes, status, deactivated_at, deactivation_reason,
            personal_bests, personal_bests_average, updated_at
     FROM weekly_player_library
     WHERE ${weeklyV2PlayerSourceSql()}
     ORDER BY name`
  );
  return rows.map(mapLibraryRow);
}

export async function listWeeklyEligiblePlayers(): Promise<WeeklyPlayerLibraryEntry[]> {
  const players = await listWeeklyPlayerLibrary();
  return players.filter((player) => isWeeklyV2ActivePlayer({ status: player.status || "inactive", source: player.source }));
}

export async function listWeeklyWcaMatchCandidates(playerId?: string): Promise<WeeklyWcaMatchCandidate[]> {
  const players = await listWeeklyEligiblePlayers();
  const sourceProfiles = await getWcaMatchingProfiles();
  const targetPlayers = playerId ? players.filter((player) => player.id === playerId) : players;
  const pool = getPostgresPool();

  for (const player of targetPlayers) {
    for (const candidate of scoreWcaCandidates(player, sourceProfiles)) {
      await pool.query(
        `INSERT INTO weekly_player_wca_matches
          (weekly_player_id, wca_id, wca_name, gender, province, city, score, method, evidence, status, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'suggested',now())
         ON CONFLICT (weekly_player_id, wca_id) DO UPDATE
           SET wca_name = EXCLUDED.wca_name,
               gender = EXCLUDED.gender,
               province = EXCLUDED.province,
               city = EXCLUDED.city,
               score = EXCLUDED.score,
               method = EXCLUDED.method,
               evidence = EXCLUDED.evidence,
               updated_at = now()
         WHERE weekly_player_wca_matches.status = 'suggested'`,
        [
          player.id,
          candidate.wcaId,
          candidate.name,
          candidate.gender,
          candidate.province,
          candidate.city,
          candidate.score,
          candidate.method,
          JSON.stringify(candidate.evidence)
        ]
      );
    }
  }

  const values = playerId ? [playerId] : [];
  const result = await pool.query<WeeklyWcaMatchRow>(
    `SELECT wpm.id, wpm.weekly_player_id, wpm.wca_id, wpm.wca_name, wpm.gender, wpm.province, wpm.city, wpm.score, wpm.method, wpm.evidence, wpm.status, wpm.confirmed_at, wpm.updated_at
       FROM weekly_player_wca_matches wpm
       JOIN weekly_player_library wpl ON wpl.id = wpm.weekly_player_id
      WHERE ${weeklyV2ActivePlayerSql("wpl")}${playerId ? " AND wpm.weekly_player_id = $1" : ""}
      ORDER BY wpm.score DESC, wpm.updated_at DESC`,
    values
  );
  return result.rows.map(mapWcaMatchRow);
}

export async function confirmWeeklyWcaMatch(input: { weeklyPlayerId: string; wcaId: string }) {
  const wcaId = input.wcaId.trim().toUpperCase();
  const pool = getPostgresPool();
  const existingCandidate = await pool.query("SELECT 1 FROM weekly_player_wca_matches WHERE weekly_player_id = $1 AND wca_id = $2 LIMIT 1", [input.weeklyPlayerId, wcaId]);
  if (!existingCandidate.rows[0]) await listWeeklyWcaMatchCandidates(input.weeklyPlayerId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const candidate = await client.query<WeeklyWcaMatchRow>(
      `SELECT id, weekly_player_id, wca_id, wca_name, gender, province, city, score, method, evidence, status, confirmed_at, updated_at
         FROM weekly_player_wca_matches
        WHERE weekly_player_id = $1 AND wca_id = $2
        LIMIT 1
        FOR UPDATE`,
      [input.weeklyPlayerId, wcaId]
    );
    if (!candidate.rows[0]) throw new Error("WCA 匹配候选不存在");

    const conflict = await client.query<{ id: string }>(
      `SELECT weekly_player_id AS id
         FROM weekly_player_wca_matches
        WHERE wca_id = $1 AND status = 'confirmed' AND weekly_player_id <> $2
        LIMIT 1`,
      [wcaId, input.weeklyPlayerId]
    );
    if (conflict.rows[0]) throw new Error("这个 WCA ID 已确认给另一名周赛选手");

    const player = await client.query<{ wca_id: string; wca_id_confirmed: boolean }>(
      `SELECT wca_id, wca_id_confirmed FROM weekly_player_library WHERE id = $1 AND ${weeklyV2ActivePlayerSql()} FOR UPDATE`,
      [input.weeklyPlayerId]
    );
    if (!player.rows[0]) throw new Error("周赛选手不存在");
    if (player.rows[0].wca_id_confirmed && player.rows[0].wca_id.toUpperCase() !== wcaId) {
      throw new Error("该选手已有另一个已确认的 WCA ID");
    }

    await client.query(
      "UPDATE weekly_player_wca_matches SET status = CASE WHEN wca_id = $1 THEN 'confirmed' ELSE 'rejected' END, confirmed_at = CASE WHEN wca_id = $1 THEN now() ELSE confirmed_at END, updated_at = now() WHERE weekly_player_id = $2",
      [wcaId, input.weeklyPlayerId]
    );
    await client.query(
      `UPDATE weekly_player_library
          SET wca_id = CASE WHEN wca_id = '' OR wca_id = $1 THEN $1 ELSE wca_id END,
              wca_id_confirmed = CASE WHEN wca_id = '' OR wca_id = $1 THEN TRUE ELSE wca_id_confirmed END,
              updated_at = now()
        WHERE id = $2 AND ${weeklyV2ActivePlayerSql()}`,
      [wcaId, input.weeklyPlayerId]
    );
    await client.query("COMMIT");
    return mapWcaMatchRow(candidate.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function rejectWeeklyWcaMatch(input: { weeklyPlayerId: string; wcaId: string }) {
  const pool = getPostgresPool();
  const { rowCount } = await pool.query(
    `UPDATE weekly_player_wca_matches
        SET status = 'rejected', updated_at = now()
      WHERE weekly_player_id = $1 AND wca_id = $2 AND status <> 'confirmed'
        AND EXISTS (SELECT 1 FROM weekly_player_library wpl WHERE wpl.id = weekly_player_wca_matches.weekly_player_id AND ${weeklyV2ActivePlayerSql("wpl")})`,
    [input.weeklyPlayerId, input.wcaId.trim().toUpperCase()]
  );
  if (!rowCount) throw new Error("WCA 匹配候选不存在或已经确认");
}

export async function findWeeklyEligiblePlayer(input: { id?: string; name?: string }) {
  const id = input.id?.trim() || "";
  if (!id) return null;

  const player = await findWeeklyPlayerLibraryEntry({ id });
  return player && isWeeklyV2ActivePlayer({ status: player.status || "inactive", source: player.source }) ? player : null;
}

export async function findWeeklyPlayerLibraryEntry(input: { id?: string; name?: string }) {
  const id = input.id?.trim() || "";
  const name = input.name?.trim() || "";
  if (!id && !name) return null;

  const pool = getPostgresPool();
  const { rows } = await pool.query<WeeklyPlayerLibraryRow>(
    `SELECT id, name, wca_id, wca_id_confirmed, gender, birth_date, age_group_override, age_group_is_fuzzy,
            province, city, source, notes, status, deactivated_at, deactivation_reason,
            personal_bests, personal_bests_average, updated_at
     FROM weekly_player_library
     WHERE (($1 <> '' AND id = $1) OR ($1 = '' AND name = $2))
       AND ${weeklyV2PlayerSourceSql()}
     ORDER BY id
     LIMIT 2`,
    [id, name]
  );
  if (!id && rows.length > 1) throw new Error("存在同名周赛选手，请使用 player_id 指定选手");
  if (!rows[0]) return null;
  return mapLibraryRow(rows[0]);
}

export async function saveWeeklyPlayerLibrary(players: WeeklyPlayerLibraryEntry[]) {
  const normalizedPlayers = normalizePlayers(players);
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const player of normalizedPlayers) {
      if (player.wcaId) {
        const duplicate = await client.query<{ id: string }>(
          `SELECT id FROM weekly_player_library WHERE upper(wca_id) = $1 AND id <> $2 AND ${weeklyV2PlayerSourceSql()} LIMIT 1`,
          [player.wcaId.toUpperCase(), player.id]
        );
        if (duplicate.rows[0]) throw new Error("该 WCA ID 已存在或历史数据中存在重复，不能重复绑定");
      }
      await client.query(
        `INSERT INTO weekly_player_library
          (id, name, wca_id, wca_id_confirmed, gender, birth_date, age_group_override, age_group_is_fuzzy,
           province, city, source, notes, status, deactivated_at, deactivation_reason,
           personal_bests, personal_bests_average, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,now())
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name,
               wca_id = EXCLUDED.wca_id,
               wca_id_confirmed = EXCLUDED.wca_id_confirmed,
               gender = EXCLUDED.gender,
               birth_date = EXCLUDED.birth_date,
               age_group_override = EXCLUDED.age_group_override,
               age_group_is_fuzzy = EXCLUDED.age_group_is_fuzzy,
               province = EXCLUDED.province,
               city = EXCLUDED.city,
               source = EXCLUDED.source,
               notes = EXCLUDED.notes,
               status = EXCLUDED.status,
               deactivated_at = EXCLUDED.deactivated_at,
               deactivation_reason = EXCLUDED.deactivation_reason,
               personal_bests = EXCLUDED.personal_bests,
               personal_bests_average = EXCLUDED.personal_bests_average,
               updated_at = now()
         WHERE ${weeklyV2PlayerSourceSql("weekly_player_library")}`,
        [
          player.id,
          player.name,
          player.wcaId || "",
          Boolean(player.wcaIdConfirmed),
          player.gender,
          player.birthDate,
          player.ageGroup || "",
          Boolean(player.ageGroupIsFuzzy),
          player.province,
          player.city,
          player.source,
          player.notes || "",
          player.status || "active",
          player.status === "inactive" ? player.deactivatedAt || new Date().toISOString() : null,
          player.status === "inactive" ? player.deactivationReason || "" : "",
          JSON.stringify(player.personalBests || {}),
          JSON.stringify(player.personalBestAverages || {})
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listWeeklyPlayerLibrary();
}

export async function updateWeeklyPlayerLibraryEntry(input: {
  id?: string;
  name?: string;
  patch: Partial<WeeklyPlayerLibraryEntry>;
}) {
  const pool = getPostgresPool();
  const current = await pool.query<WeeklyPlayerLibraryRow>(
    `SELECT id, name, wca_id, wca_id_confirmed, gender, birth_date, age_group_override, age_group_is_fuzzy,
            province, city, source, notes, status, deactivated_at, deactivation_reason,
            personal_bests, personal_bests_average, updated_at
     FROM weekly_player_library
     WHERE (($1 <> '' AND id = $1) OR ($1 = '' AND name = $2))
       AND ${weeklyV2PlayerSourceSql()}
     ORDER BY id
     LIMIT 2`,
    [input.id?.trim() || "", input.name?.trim() || ""]
  );
  if (!input.id?.trim() && current.rows.length > 1) {
    throw new Error("存在同名周赛选手，请使用 player_id 指定要编辑的档案");
  }
  const row = current.rows[0];
  if (!row) throw new Error("周赛选手不存在");

  const patch = input.patch;
  const name = patch.name?.trim() || row.name;
  if (!name) throw new Error("请填写选手姓名");
  const birthDate = patch.birthDate?.trim() ?? row.birth_date;
  const wcaId = patch.wcaId?.trim().toUpperCase() ?? row.wca_id;
  if (wcaId) {
    const duplicate = await pool.query<{ id: string }>(
      `SELECT id FROM weekly_player_library WHERE upper(wca_id) = $1 AND id <> $2 AND ${weeklyV2PlayerSourceSql()} LIMIT 1`,
      [wcaId, row.id]
    );
    if (duplicate.rows[0]) throw new Error("该 WCA ID 已存在或历史数据中存在重复，不能重复绑定");
  }
  const ageGroup = birthDate ? "" : patch.ageGroup?.trim() ?? row.age_group_override;
  const status = patch.status === "inactive" ? "inactive" : patch.status === "active" ? "active" : row.status;
  const deactivatedAt = status === "inactive" ? patch.deactivatedAt ?? row.deactivated_at ?? new Date().toISOString() : null;
  const deactivationReason = status === "inactive" ? patch.deactivationReason?.trim() ?? row.deactivation_reason : "";
  const { rows } = await pool.query<WeeklyPlayerLibraryRow>(
    `UPDATE weekly_player_library
     SET name = $2, wca_id = $3, wca_id_confirmed = $4, gender = $5, birth_date = $6,
         age_group_override = $7, age_group_is_fuzzy = $8, province = $9, city = $10,
         source = $11, notes = $12, status = $13, deactivated_at = $14,
         deactivation_reason = $15, updated_at = now()
     WHERE id = $1 AND ${weeklyV2PlayerSourceSql()}
     RETURNING id, name, wca_id, wca_id_confirmed, gender, birth_date, age_group_override, age_group_is_fuzzy,
               province, city, source, notes, status, deactivated_at, deactivation_reason,
               personal_bests, personal_bests_average, updated_at`,
    [
      row.id,
      name,
      wcaId,
      patch.wcaIdConfirmed ?? row.wca_id_confirmed,
      patch.gender ?? row.gender,
      birthDate,
      ageGroup,
      birthDate ? false : (patch.ageGroupIsFuzzy ?? row.age_group_is_fuzzy),
      patch.province?.trim() ?? row.province,
      patch.city?.trim() ?? row.city,
      patch.source?.trim() ?? row.source,
      patch.notes?.trim() ?? row.notes,
      status,
      deactivatedAt,
      deactivationReason
    ]
  );
  return mapLibraryRow(rows[0]);
}

function normalizePlayers(players: WeeklyPlayerLibraryEntry[]) {
  const seen = new Set<string>();
  return players
    .map((player) => {
      const name = player.name.trim();
      const id = player.id?.trim() || createLibraryPlayerId();
      return {
        id,
        name,
        wcaId: player.wcaId?.trim().toUpperCase() || "",
        wcaIdConfirmed: Boolean(player.wcaIdConfirmed),
        gender: normalizeGender(player.gender),
        birthDate: player.birthDate.trim(),
        ageGroup: normalizeAgeGroup(player.ageGroup || "", player.birthDate),
        ageGroupIsFuzzy: !player.birthDate.trim() && (Boolean(player.ageGroupIsFuzzy) || Boolean(player.ageGroup)),
        province: player.province.trim(),
        city: player.city.trim(),
        source: player.source === "players_excel_import" ? "players_excel_import" : "admin_manual",
        notes: player.notes?.trim() || "",
        status: player.status === "inactive" ? ("inactive" as const) : ("active" as const),
        deactivatedAt: player.status === "inactive" ? player.deactivatedAt || null : null,
        deactivationReason: player.status === "inactive" ? player.deactivationReason?.trim() || "" : "",
        personalBests: normalizePersonalBests(player.personalBests),
        personalBestAverages: normalizePersonalBests(player.personalBestAverages)
      };
    })
    .filter((player) => player.name)
    .filter((player) => {
      if (seen.has(player.id)) return false;
      seen.add(player.id);
      return true;
    });
}

type WcaMatchingProfile = {
  wcaId: string;
  name: string;
  gender: WeeklyLibraryGender;
  province: string;
  city: string;
};

async function getWcaMatchingProfiles(): Promise<WcaMatchingProfile[]> {
  try {
    const profiles = await enrichLocalProfiles(await readLocalProfiles());
    const unique = new Map<string, WcaMatchingProfile>();
    for (const profile of profiles) {
      const wcaId = profile.wcaId?.trim().toUpperCase() || "";
      if (!profile.visible || profile.province !== "辽宁" || !wcaId || !profile.name.trim()) continue;
      unique.set(wcaId, {
        wcaId,
        name: profile.name.trim(),
        gender: profile.gender === "女" ? "女" : profile.gender === "男" ? "男" : "",
        province: profile.province,
        city: profile.city || ""
      });
    }
    return Array.from(unique.values());
  } catch {
    return [];
  }
}

function scoreWcaCandidates(player: WeeklyPlayerLibraryEntry, profiles: WcaMatchingProfile[]) {
  const playerNames = new Set(getWeeklyNameVariants(player.name));
  return profiles
    .map((profile) => {
      const sameName = getWeeklyNameVariants(profile.name).some((name) => playerNames.has(name));
      if (!sameName) return null;

      const evidence = ["姓名完全匹配"];
      let score = 70;
      const sameCity = Boolean(player.city && profile.city && normalizeWeeklyName(player.city) === normalizeWeeklyName(profile.city));
      const sameGender = Boolean(player.gender && profile.gender && player.gender === profile.gender);
      if (sameCity) {
        score += 20;
        evidence.push("城市一致");
      }
      if (sameGender) {
        score += 10;
        evidence.push("性别一致");
      }

      const method = sameCity && sameGender
        ? "name_city_gender"
        : sameCity
          ? "name_city"
          : sameGender
            ? "name_gender"
            : "exact_name";
      return { ...profile, score, method, evidence };
    })
    .filter((candidate): candidate is WcaMatchingProfile & { score: number; method: WeeklyWcaMatchCandidate["method"]; evidence: string[] } => Boolean(candidate))
    .sort((a, b) => b.score - a.score || a.wcaId.localeCompare(b.wcaId));
}

function mapWcaMatchRow(row: WeeklyWcaMatchRow): WeeklyWcaMatchCandidate {
  const method: WeeklyWcaMatchCandidate["method"] = ["exact_name", "name_city", "name_gender", "name_city_gender"].includes(row.method)
    ? row.method as WeeklyWcaMatchCandidate["method"]
    : "exact_name";
  const status: WeeklyWcaMatchCandidate["status"] = row.status === "confirmed" || row.status === "rejected" ? row.status : "suggested";
  return {
    id: row.id,
    weeklyPlayerId: row.weekly_player_id,
    wcaId: row.wca_id,
    wcaName: row.wca_name,
    gender: row.gender === "女" ? "女" : row.gender === "男" ? "男" : "",
    province: row.province,
    city: row.city,
    score: row.score,
    method,
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    status,
    confirmedAt: row.confirmed_at,
    updatedAt: row.updated_at
  };
}

function normalizeWeeklyName(value: string) {
  return value.normalize("NFKC").replace(/[\s·•・,，.。()（）\[\]{}<>《》'"“”‘’]/g, "").toLowerCase();
}

function getWeeklyNameVariants(value: string) {
  const name = value.trim();
  if (!name) return [];
  const variants = new Set<string>([normalizeWeeklyName(name)]);
  const chineseParts = name.match(/[\u3400-\u9fff]+/g)?.join("") || "";
  if (chineseParts) variants.add(normalizeWeeklyName(chineseParts));
  return [...variants].filter(Boolean);
}

function mapLibraryRow(row: WeeklyPlayerLibraryRow): WeeklyPlayerLibraryEntry {
  return {
    id: row.id,
    name: row.name,
    wcaId: row.wca_id || "",
    wcaIdConfirmed: Boolean(row.wca_id_confirmed),
    gender: normalizeGender(row.gender),
    birthDate: row.birth_date || "",
    ageGroup: getWeeklyAgeGroup(row.birth_date || "") || row.age_group_override || "",
    ageGroupIsFuzzy: Boolean(row.age_group_is_fuzzy) || (!row.birth_date && Boolean(row.age_group_override)),
    province: row.province || "",
    city: row.city || "",
    source: row.source || "",
    notes: row.notes || "",
    status: row.status === "inactive" ? "inactive" : "active",
    deactivatedAt: row.deactivated_at,
    deactivationReason: row.deactivation_reason || "",
    personalBests: normalizePersonalBests(row.personal_bests || {}),
    personalBestAverages: normalizePersonalBests(row.personal_bests_average || {}),
    updatedAt: row.updated_at
  };
}

function normalizeGender(gender: string): WeeklyLibraryGender {
  if (gender === "男" || gender === "女") return gender;
  return "";
}

function normalizeAgeGroup(ageGroup: string, birthDate: string) {
  const calculated = getWeeklyAgeGroup(birthDate);
  if (calculated) return "";
  const value = ageGroup.trim().toUpperCase();
  return [...weeklyAgeGroups, "成人"].includes(value) ? value : "";
}

function normalizePersonalBests(value: unknown): WeeklyPersonalBests {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  const next: WeeklyPersonalBests = {};
  for (const eventId of ["333", "222", "pyram", "mirror", "maple", "skewb", "allAround"] as const) {
    const score = Number(input[eventId]);
    if (Number.isFinite(score) && score > 0) next[eventId] = score;
  }
  return next;
}

export function createLibraryPlayerId() {
  return `weekly-player-${randomUUID()}`;
}
