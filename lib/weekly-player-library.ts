import { getPostgresPool } from "@/lib/postgres";
import { enrichLocalProfiles, readLocalProfiles } from "@/lib/local-profile-store";
import { commercialTeamMembers } from "@/lib/commercial-teams";
import { getWeeklyAgeGroup, weeklyAgeGroups } from "@/lib/weekly-age-groups";

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
  personalBests?: WeeklyPersonalBests;
  personalBestAverages?: WeeklyPersonalBests;
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

const mofang602Names = [
  "韩沐遥",
  "高云淼",
  "蒋茗朗",
  "张皓博",
  "王亦龙",
  "王晋宁",
  "黄梓墨",
  "王芮茜",
  "王一帆",
  "田泽云",
  "刘乙辰",
  "丁俊森",
  "全梓铭",
  "李恒恺",
  "韩迦南",
  "王羿程",
  "单禹桥",
  "王洛柠",
  "邹滨瑞",
  "王曦",
  "徐安儿",
  "李轩伊",
  "吴秋铜",
  "姜博文",
  "王路喻",
  "李沐远",
  "杨雯博",
  "钟欣妍",
  "张俊熙",
  "李梓源",
  "傅梓毓",
  "陈梦依",
  "姜凯超",
  "由子墨",
  "王梦伊",
  "李禹诺",
  "李姜宁",
  "王子睿",
  "杨意可",
  "柳一依",
  "张彦烁",
  "张成贤"
];

const mofang602FemaleNames = new Set([
  "韩沐遥",
  "高云淼",
  "王芮茜",
  "全梓铭",
  "王洛柠",
  "王曦",
  "徐安儿",
  "李轩伊",
  "吴秋铜",
  "王路喻",
  "钟欣妍",
  "陈梦依",
  "由子墨",
  "王梦伊",
  "李姜宁",
  "杨意可",
  "柳一依"
]);

const weeklyTestPlayers: WeeklyPlayerLibraryEntry[] = [
  {
    id: "weekly-test-liu-yiming",
    name: "刘一鸣",
    wcaId: "2009LIUY03",
    gender: "男",
    birthDate: "",
    ageGroup: "",
    ageGroupIsFuzzy: false,
    province: "辽宁",
    city: "沈阳",
    source: "本地测试数据"
  }
];

export async function ensureWeeklyPlayerLibraryTable() {
  const pool = getPostgresPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weekly_player_library (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT '',
      wca_id TEXT NOT NULL DEFAULT '',
      wca_id_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
      birth_date TEXT NOT NULL DEFAULT '',
      age_group_override TEXT NOT NULL DEFAULT '',
      age_group_is_fuzzy BOOLEAN NOT NULL DEFAULT FALSE,
      province TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      personal_bests JSONB NOT NULL DEFAULT '{}'::jsonb,
      personal_bests_average JSONB NOT NULL DEFAULT '{}'::jsonb,
      personal_bests_base JSONB NOT NULL DEFAULT '{}'::jsonb,
      personal_bests_average_base JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS wca_id TEXT NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS wca_id_confirmed BOOLEAN NOT NULL DEFAULT FALSE");
  await pool.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS age_group_override TEXT NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS age_group_is_fuzzy BOOLEAN NOT NULL DEFAULT FALSE");
  await pool.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS personal_bests JSONB NOT NULL DEFAULT '{}'::jsonb");
  await pool.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS personal_bests_average JSONB NOT NULL DEFAULT '{}'::jsonb");
  await pool.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS personal_bests_base JSONB NOT NULL DEFAULT '{}'::jsonb");
  await pool.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS personal_bests_average_base JSONB NOT NULL DEFAULT '{}'::jsonb");
  await pool.query("UPDATE weekly_player_library SET personal_bests_base = personal_bests WHERE personal_bests_base = '{}'::jsonb AND personal_bests <> '{}'::jsonb");
  await pool.query("UPDATE weekly_player_library SET personal_bests_average_base = personal_bests_average WHERE personal_bests_average_base = '{}'::jsonb AND personal_bests_average <> '{}'::jsonb");
  await pool.query("CREATE INDEX IF NOT EXISTS weekly_player_library_name_idx ON weekly_player_library (name)");
  await pool.query("CREATE INDEX IF NOT EXISTS weekly_player_library_wca_id_idx ON weekly_player_library (wca_id)");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weekly_player_wca_matches (
      id BIGSERIAL PRIMARY KEY,
      weekly_player_id TEXT NOT NULL,
      wca_id TEXT NOT NULL,
      wca_name TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT '',
      province TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      score INTEGER NOT NULL DEFAULT 0,
      method TEXT NOT NULL DEFAULT 'exact_name',
      evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'suggested',
      confirmed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (weekly_player_id, wca_id)
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS weekly_player_wca_matches_player_idx ON weekly_player_wca_matches (weekly_player_id, status, score DESC)");
  await pool.query("CREATE INDEX IF NOT EXISTS weekly_player_wca_matches_wca_idx ON weekly_player_wca_matches (wca_id, status)");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS weekly_player_wca_matches_confirmed_wca_idx ON weekly_player_wca_matches (wca_id) WHERE status = 'confirmed'");
}

export async function listWeeklyPlayerLibrary(options: { initialize?: boolean } = {}): Promise<WeeklyPlayerLibraryEntry[]> {
  if (options.initialize !== false) {
    await ensureWeeklyPlayerLibraryTable();
    await seedMofang602Players();
    await backfillMofang602Genders();
  }

  const pool = getPostgresPool();
  const { rows } = await pool.query<WeeklyPlayerLibraryRow>(
    `SELECT id, name, wca_id, wca_id_confirmed, gender, birth_date, age_group_override, age_group_is_fuzzy, province, city, source, personal_bests, personal_bests_average, updated_at
     FROM weekly_player_library
     ORDER BY name`
  );
  return rows.map(mapLibraryRow);
}

export async function listWeeklyEligiblePlayers(options: { initialize?: boolean } = {}): Promise<WeeklyPlayerLibraryEntry[]> {
  const [wcaPlayers, libraryPlayers] = await Promise.all([
    listWcaLiaoningPlayers(),
    listWeeklyPlayerLibrary(options)
  ]);
  return mergeWeeklyEligiblePlayers(wcaPlayers, libraryPlayers);
}

export async function listWeeklyWcaMatchCandidates(playerId?: string): Promise<WeeklyWcaMatchCandidate[]> {
  await ensureWeeklyPlayerLibraryTable();
  const players = await listWeeklyPlayerLibrary();
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
    `SELECT id, weekly_player_id, wca_id, wca_name, gender, province, city, score, method, evidence, status, confirmed_at, updated_at
       FROM weekly_player_wca_matches
      ${playerId ? "WHERE weekly_player_id = $1" : ""}
      ORDER BY score DESC, updated_at DESC`,
    values
  );
  return result.rows.map(mapWcaMatchRow);
}

export async function confirmWeeklyWcaMatch(input: { weeklyPlayerId: string; wcaId: string }) {
  await ensureWeeklyPlayerLibraryTable();
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
      "SELECT wca_id, wca_id_confirmed FROM weekly_player_library WHERE id = $1 FOR UPDATE",
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
        WHERE id = $2`,
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
  await ensureWeeklyPlayerLibraryTable();
  const pool = getPostgresPool();
  const { rowCount } = await pool.query(
    `UPDATE weekly_player_wca_matches
        SET status = 'rejected', updated_at = now()
      WHERE weekly_player_id = $1 AND wca_id = $2 AND status <> 'confirmed'`,
    [input.weeklyPlayerId, input.wcaId.trim().toUpperCase()]
  );
  if (!rowCount) throw new Error("WCA 匹配候选不存在或已经确认");
}

export async function findWeeklyEligiblePlayer(input: { id?: string; name?: string }) {
  const id = input.id?.trim() || "";
  const name = input.name?.trim() || "";
  if (!id && !name) return null;

  const players = await listWeeklyEligiblePlayers();
  return players.find((player) => player.id === id) || players.find((player) => player.wcaId === id.toUpperCase()) || players.find((player) => player.name === name) || null;
}

export function getMofang602SeedWeeklyPlayers(): WeeklyPlayerLibraryEntry[] {
  return [
    ...mofang602Names.map((name) => ({
      id: createSeedId(name),
      name,
      gender: mofang602FemaleNames.has(name) ? ("女" as const) : ("男" as const),
      birthDate: "",
      ageGroup: "",
      ageGroupIsFuzzy: false,
      province: "辽宁",
      city: "",
      source: "mofang123 第334周三阶表"
    })),
    ...weeklyTestPlayers
  ];
}

export async function findWeeklyPlayerLibraryEntry(input: { id?: string; name?: string }) {
  await ensureWeeklyPlayerLibraryTable();
  const id = input.id?.trim() || "";
  const name = input.name?.trim() || "";
  if (!id && !name) return null;

  const pool = getPostgresPool();
  const { rows } = await pool.query<WeeklyPlayerLibraryRow>(
    `SELECT id, name, wca_id, wca_id_confirmed, gender, birth_date, age_group_override, age_group_is_fuzzy, province, city, source, personal_bests, updated_at
     FROM weekly_player_library
     WHERE id = $1 OR name = $2
     LIMIT 1`,
    [id, name]
  );
  if (!rows[0]) return null;
  const [player] = await enrichWeeklyPlayerMatches([mapLibraryRow(rows[0])]);
  return player || null;
}

export async function saveWeeklyPlayerLibrary(players: WeeklyPlayerLibraryEntry[]) {
  await ensureWeeklyPlayerLibraryTable();
  const normalizedPlayers = normalizePlayers(players);
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const player of normalizedPlayers) {
      await client.query(
        `INSERT INTO weekly_player_library
          (id, name, wca_id, wca_id_confirmed, gender, birth_date, age_group_override, age_group_is_fuzzy, province, city, source, personal_bests, personal_bests_average, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,now())
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
               personal_bests = EXCLUDED.personal_bests,
               personal_bests_average = EXCLUDED.personal_bests_average,
               updated_at = now()`,
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
  await ensureWeeklyPlayerLibraryTable();
  const pool = getPostgresPool();
  const current = await pool.query<WeeklyPlayerLibraryRow>(
    `SELECT id, name, wca_id, wca_id_confirmed, gender, birth_date, age_group_override, age_group_is_fuzzy, province, city, source, personal_bests, personal_bests_average, updated_at
     FROM weekly_player_library
     WHERE id = $1 OR name = $2
     ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [input.id?.trim() || "", input.name?.trim() || ""]
  );
  const row = current.rows[0];
  if (!row) throw new Error("周赛选手不存在");

  const patch = input.patch;
  const name = patch.name?.trim() || row.name;
  if (!name) throw new Error("请填写选手姓名");
  const birthDate = patch.birthDate?.trim() ?? row.birth_date;
  const wcaId = patch.wcaId?.trim().toUpperCase() ?? row.wca_id;
  const ageGroup = birthDate ? "" : patch.ageGroup?.trim() ?? row.age_group_override;
  const { rows } = await pool.query<WeeklyPlayerLibraryRow>(
    `UPDATE weekly_player_library
     SET name = $2, wca_id = $3, wca_id_confirmed = $4, gender = $5, birth_date = $6,
         age_group_override = $7, age_group_is_fuzzy = $8, province = $9, city = $10,
         source = $11, updated_at = now()
     WHERE id = $1
     RETURNING id, name, wca_id, wca_id_confirmed, gender, birth_date, age_group_override, age_group_is_fuzzy, province, city, source, personal_bests, personal_bests_average, updated_at`,
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
      patch.source?.trim() ?? row.source
    ]
  );
  return mapLibraryRow(rows[0]);
}

function normalizePlayers(players: WeeklyPlayerLibraryEntry[]) {
  const seen = new Set<string>();
  return players
    .map((player) => {
      const name = player.name.trim();
      const id = player.id?.trim() || createLibraryPlayerId(name);
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
        source: player.source.trim(),
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

async function enrichWeeklyPlayerMatches(players: WeeklyPlayerLibraryEntry[]) {
  if (players.length === 0) return players;

  const localMatchesByName = await getLocalMatchesByName();

  return players.map((player) => {
    const localMatch = getWeeklyNameVariants(player.name)
      .map((name) => localMatchesByName.get(name))
      .find(Boolean);
    const ageGroup = getWeeklyAgeGroup(player.birthDate) || normalizeAgeGroup(player.ageGroup || "", "");
    return {
      ...player,
      wcaId: localMatch?.wcaId || player.wcaId || "",
      ageGroup,
      ageGroupIsFuzzy: !player.birthDate && Boolean(ageGroup),
      province: localMatch?.province || player.province || "",
      city: localMatch?.city || player.city || ""
    };
  });
}

async function listWcaLiaoningPlayers(): Promise<WeeklyPlayerLibraryEntry[]> {
  const profiles = await enrichLocalProfiles(await readLocalProfiles());
  return profiles
    .filter((profile) => profile.visible && profile.province === "辽宁" && profile.wcaId && profile.name)
    .map((profile) => ({
      id: `wca:${profile.wcaId}`,
      name: profile.name,
        wcaId: profile.wcaId,
        wcaIdConfirmed: false,
      gender: profile.gender === "女" ? "女" : profile.gender === "男" ? "男" : "",
      birthDate: "",
      ageGroup: "",
      ageGroupIsFuzzy: false,
      province: profile.province,
      city: profile.city,
      source: "WCA 辽宁选手库"
    }));
}

function mergeWeeklyEligiblePlayers(wcaPlayers: WeeklyPlayerLibraryEntry[], libraryPlayers: WeeklyPlayerLibraryEntry[]) {
  const merged: WeeklyPlayerLibraryEntry[] = [];
  const indexByWcaId = new Map<string, number>();

  for (const player of [...wcaPlayers, ...libraryPlayers]) {
    const wcaId = player.wcaId?.trim().toUpperCase() || "";
    const name = player.name.trim();
    if (!name) continue;

    // A name is only evidence for a candidate, never an identity key. Merge
    // records only when the WCA ID itself is identical.
    const existingIndex = wcaId ? indexByWcaId.get(wcaId) : undefined;
    if (existingIndex !== undefined) {
      const existing = merged[existingIndex];
      merged[existingIndex] = {
        ...existing,
        name: existing.name || player.name,
        gender: existing.gender || player.gender,
        wcaIdConfirmed: existing.wcaIdConfirmed || player.wcaIdConfirmed,
        birthDate: existing.birthDate || player.birthDate,
        ageGroup: existing.ageGroup || player.ageGroup,
        ageGroupIsFuzzy: existing.ageGroupIsFuzzy || player.ageGroupIsFuzzy,
        province: existing.province || player.province,
        city: existing.city || player.city,
        personalBests: Object.keys(existing.personalBests || {}).length > 0 ? existing.personalBests : player.personalBests,
        personalBestAverages: Object.keys(existing.personalBestAverages || {}).length > 0 ? existing.personalBestAverages : player.personalBestAverages,
        source: existing.source && player.source && !existing.source.includes(player.source) ? `${existing.source}；${player.source}` : existing.source || player.source
      };
      continue;
    }

    merged.push({ ...player, wcaId });
    if (wcaId) indexByWcaId.set(wcaId, merged.length - 1);
  }

  return merged;
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

async function getLocalMatchesByName() {
  try {
    const profiles = await enrichLocalProfiles(await readLocalProfiles());
    const profilesByName = new Map<string, { wcaId: string; province: string; city: string }[]>();
    const profilesByWcaId = new Map<string, { wcaId: string; province: string; city: string }>();
    for (const profile of profiles) {
      if (profile.province !== "辽宁") continue;
      const match = {
        wcaId: profile.wcaId || "",
        province: profile.province || "",
        city: profile.city || ""
      };
      if (match.wcaId) profilesByWcaId.set(match.wcaId, match);
      for (const name of getWeeklyNameVariants(profile.name)) {
        const current = profilesByName.get(name) || [];
        current.push(match);
        profilesByName.set(name, current);
      }
    }

    for (const member of commercialTeamMembers) {
      const name = member.name.trim();
      const wcaId = member.wcaId?.trim().toUpperCase() || "";
      const localProfile = wcaId ? profilesByWcaId.get(wcaId) : undefined;
      if (!name || !localProfile) continue;
      const current = profilesByName.get(normalizeWeeklyName(name)) || [];
      if (current.some((match) => match.wcaId === localProfile.wcaId)) continue;
      current.push(localProfile);
      profilesByName.set(normalizeWeeklyName(name), current);
    }

    const matches = new Map<string, { wcaId: string; province: string; city: string }>();
    for (const [name, sameNameProfiles] of profilesByName) {
      const uniqueProfiles = Array.from(
        new Map(sameNameProfiles.map((profile) => [`${profile.wcaId}:${profile.city}`, profile])).values()
      );
      if (uniqueProfiles.length !== 1) continue;
      matches.set(name, uniqueProfiles[0]);
    }
    return matches;
  } catch {
    return new Map<string, { wcaId: string; province: string; city: string }>();
  }
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

async function seedMofang602Players() {
  const pool = getPostgresPool();
  const existing = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM weekly_player_library");

  if (Number(existing.rows[0]?.count || 0) === 0) {
    for (const name of mofang602Names) {
      await pool.query(
        `INSERT INTO weekly_player_library (id, name, source)
         VALUES ($1,$2,$3)
         ON CONFLICT (id) DO NOTHING`,
        [createSeedId(name), name, "mofang123 第334周三阶表"]
      );
    }
  }

  for (const player of weeklyTestPlayers) {
    await pool.query(
      `INSERT INTO weekly_player_library (id, name, wca_id, gender, birth_date, age_group_override, age_group_is_fuzzy, province, city, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE
         SET wca_id = CASE WHEN weekly_player_library.wca_id = '' THEN EXCLUDED.wca_id ELSE weekly_player_library.wca_id END,
             gender = CASE WHEN weekly_player_library.gender = '' THEN EXCLUDED.gender ELSE weekly_player_library.gender END,
             province = CASE WHEN weekly_player_library.province = '' THEN EXCLUDED.province ELSE weekly_player_library.province END,
             city = CASE WHEN weekly_player_library.city = '' THEN EXCLUDED.city ELSE weekly_player_library.city END,
             source = CASE WHEN weekly_player_library.source = '' THEN EXCLUDED.source ELSE weekly_player_library.source END`,
      [
        player.id,
        player.name,
        player.wcaId || "",
        player.gender,
        player.birthDate,
        player.ageGroup || "",
        Boolean(player.ageGroupIsFuzzy),
        player.province,
        player.city,
        player.source
      ]
    );
  }
}

async function backfillMofang602Genders() {
  const pool = getPostgresPool();
  for (const name of mofang602Names) {
    await pool.query("UPDATE weekly_player_library SET gender = $1 WHERE id = $2 AND gender = ''", [
      mofang602FemaleNames.has(name) ? "女" : "男",
      createSeedId(name)
    ]);
  }
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

function createSeedId(name: string) {
  return `mofang602-${slugifyName(name)}`;
}

export function createLibraryPlayerId(name: string) {
  const base = slugifyName(name) || Date.now().toString(36);
  return `weekly-library-${base}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugifyName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
