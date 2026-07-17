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

type WeeklyPlayerLibraryRow = {
  id: string;
  name: string;
  wca_id: string;
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
      birth_date TEXT NOT NULL DEFAULT '',
      age_group_override TEXT NOT NULL DEFAULT '',
      age_group_is_fuzzy BOOLEAN NOT NULL DEFAULT FALSE,
      province TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      personal_bests JSONB NOT NULL DEFAULT '{}'::jsonb,
      personal_bests_average JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS wca_id TEXT NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS age_group_override TEXT NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS age_group_is_fuzzy BOOLEAN NOT NULL DEFAULT FALSE");
  await pool.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS personal_bests JSONB NOT NULL DEFAULT '{}'::jsonb");
  await pool.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS personal_bests_average JSONB NOT NULL DEFAULT '{}'::jsonb");
  await pool.query("CREATE INDEX IF NOT EXISTS weekly_player_library_name_idx ON weekly_player_library (name)");
  await pool.query("CREATE INDEX IF NOT EXISTS weekly_player_library_wca_id_idx ON weekly_player_library (wca_id)");
}

export async function listWeeklyPlayerLibrary(): Promise<WeeklyPlayerLibraryEntry[]> {
  await ensureWeeklyPlayerLibraryTable();
  await seedMofang602Players();
  await backfillMofang602Genders();

  const pool = getPostgresPool();
  const { rows } = await pool.query<WeeklyPlayerLibraryRow>(
    `SELECT id, name, wca_id, gender, birth_date, age_group_override, age_group_is_fuzzy, province, city, source, personal_bests, personal_bests_average, updated_at
     FROM weekly_player_library
     ORDER BY name`
  );
  const players = await enrichWeeklyPlayerMatches(rows.map(mapLibraryRow));
  await persistWeeklyPlayerMatches(players);
  return players;
}

export async function listWeeklyEligiblePlayers(): Promise<WeeklyPlayerLibraryEntry[]> {
  const [wcaPlayers, libraryPlayers] = await Promise.all([listWcaLiaoningPlayers(), listWeeklyPlayerLibrary()]);
  return mergeWeeklyEligiblePlayers(wcaPlayers, libraryPlayers);
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
    `SELECT id, name, wca_id, gender, birth_date, age_group_override, age_group_is_fuzzy, province, city, source, personal_bests, updated_at
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
    const ids = normalizedPlayers.map((player) => player.id);
    await client.query("DELETE FROM weekly_player_library WHERE NOT (id = ANY($1::text[]))", [ids]);

    for (const player of normalizedPlayers) {
      await client.query(
        `INSERT INTO weekly_player_library
          (id, name, wca_id, gender, birth_date, age_group_override, age_group_is_fuzzy, province, city, source, personal_bests, personal_bests_average, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,now())
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name,
               wca_id = EXCLUDED.wca_id,
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
    const localMatch = localMatchesByName.get(player.name);
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
  const indexByName = new Map<string, number>();
  const indexByWcaId = new Map<string, number>();
  const seenWcaIds = new Set<string>();

  for (const player of [...wcaPlayers, ...libraryPlayers]) {
    const wcaId = player.wcaId?.trim().toUpperCase() || "";
    const name = player.name.trim();
    if (!name) continue;

    const nameKey = getWeeklyPlayerNameKey(name);
    const existingIndex = (wcaId ? indexByWcaId.get(wcaId) : undefined) ?? indexByName.get(nameKey);
    if (existingIndex !== undefined) {
      const existing = merged[existingIndex];
      if (existing.wcaId || !wcaId) {
        if (existing.wcaId) {
          merged[existingIndex] = {
            ...existing,
            gender: existing.gender || player.gender,
            birthDate: player.birthDate || existing.birthDate,
            ageGroup: player.ageGroup || existing.ageGroup,
            ageGroupIsFuzzy: player.ageGroupIsFuzzy || existing.ageGroupIsFuzzy,
            province: player.province || existing.province,
            city: player.city || existing.city,
            personalBests: Object.keys(player.personalBests || {}).length > 0 ? player.personalBests : existing.personalBests,
            personalBestAverages: Object.keys(player.personalBestAverages || {}).length > 0 ? player.personalBestAverages : existing.personalBestAverages,
            source: player.source && !existing.source.includes(player.source) ? `${existing.source}；${player.source}` : existing.source
          };
          indexByName.set(nameKey, existingIndex);
        }
        continue;
      }
      merged[existingIndex] = {
        ...player,
        wcaId,
        personalBests: existing.personalBests || player.personalBests || {},
        personalBestAverages: existing.personalBestAverages || player.personalBestAverages || {}
      };
      indexByName.set(nameKey, existingIndex);
      indexByWcaId.set(wcaId, existingIndex);
      seenWcaIds.add(wcaId);
      continue;
    }

    merged.push({ ...player, wcaId });
    indexByName.set(nameKey, merged.length - 1);
    if (wcaId) indexByWcaId.set(wcaId, merged.length - 1);
    if (wcaId) seenWcaIds.add(wcaId);
  }

  return merged;
}

function getWeeklyPlayerNameKey(name: string) {
  const chineseName = name.match(/[\u3400-\u9fff]/g)?.join("");
  return (chineseName || name).trim().toLowerCase();
}

async function persistWeeklyPlayerMatches(players: WeeklyPlayerLibraryEntry[]) {
  const matchedPlayers = players.filter((player) => player.wcaId || player.province || player.city);
  if (matchedPlayers.length === 0) return;
  const pool = getPostgresPool();
  for (const player of matchedPlayers) {
    await pool.query(
      `UPDATE weekly_player_library
       SET wca_id = CASE WHEN $2 <> '' THEN $2 ELSE wca_id END,
           province = CASE WHEN $3 <> '' THEN $3 ELSE province END,
           city = CASE WHEN $4 <> '' THEN $4 ELSE city END
       WHERE id = $1`,
      [player.id, player.wcaId || "", player.province || "", player.city || ""]
    );
  }
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
      const name = profile.name?.trim();
      if (!name) continue;
      const current = profilesByName.get(name) || [];
      current.push(match);
      profilesByName.set(name, current);
    }

    for (const member of commercialTeamMembers) {
      const name = member.name.trim();
      const wcaId = member.wcaId?.trim().toUpperCase() || "";
      const localProfile = wcaId ? profilesByWcaId.get(wcaId) : undefined;
      if (!name || !localProfile) continue;
      const current = profilesByName.get(name) || [];
      if (current.some((match) => match.wcaId === localProfile.wcaId)) continue;
      current.push(localProfile);
      profilesByName.set(name, current);
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
