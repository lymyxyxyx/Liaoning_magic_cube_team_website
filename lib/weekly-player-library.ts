import { getPostgresPool } from "@/lib/postgres";

export type WeeklyLibraryGender = "" | "男" | "女";

export type WeeklyPlayerLibraryEntry = {
  id: string;
  name: string;
  gender: WeeklyLibraryGender;
  birthDate: string;
  province: string;
  city: string;
  source: string;
  updatedAt?: string;
};

type WeeklyPlayerLibraryRow = {
  id: string;
  name: string;
  gender: string;
  birth_date: string;
  province: string;
  city: string;
  source: string;
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

export async function ensureWeeklyPlayerLibraryTable() {
  const pool = getPostgresPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weekly_player_library (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT '',
      birth_date TEXT NOT NULL DEFAULT '',
      province TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS weekly_player_library_name_idx ON weekly_player_library (name)");
}

export async function listWeeklyPlayerLibrary(): Promise<WeeklyPlayerLibraryEntry[]> {
  await ensureWeeklyPlayerLibraryTable();
  await seedMofang602Players();
  await backfillMofang602Genders();

  const pool = getPostgresPool();
  const { rows } = await pool.query<WeeklyPlayerLibraryRow>(
    `SELECT id, name, gender, birth_date, province, city, source, updated_at
     FROM weekly_player_library
     ORDER BY name`
  );
  return rows.map(mapLibraryRow);
}

export function getMofang602SeedWeeklyPlayers(): WeeklyPlayerLibraryEntry[] {
  return mofang602Names.map((name) => ({
    id: createSeedId(name),
    name,
    gender: mofang602FemaleNames.has(name) ? "女" : "男",
    birthDate: "",
    province: "辽宁",
    city: "",
    source: "mofang123 第334周三阶表"
  }));
}

export async function findWeeklyPlayerLibraryEntry(input: { id?: string; name?: string }) {
  await ensureWeeklyPlayerLibraryTable();
  const id = input.id?.trim() || "";
  const name = input.name?.trim() || "";
  if (!id && !name) return null;

  const pool = getPostgresPool();
  const { rows } = await pool.query<WeeklyPlayerLibraryRow>(
    `SELECT id, name, gender, birth_date, province, city, source, updated_at
     FROM weekly_player_library
     WHERE id = $1 OR name = $2
     LIMIT 1`,
    [id, name]
  );
  return rows[0] ? mapLibraryRow(rows[0]) : null;
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
          (id, name, gender, birth_date, province, city, source, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,now())
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name,
               gender = EXCLUDED.gender,
               birth_date = EXCLUDED.birth_date,
               province = EXCLUDED.province,
               city = EXCLUDED.city,
               source = EXCLUDED.source,
               updated_at = now()`,
        [player.id, player.name, player.gender, player.birthDate, player.province, player.city, player.source]
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
        gender: normalizeGender(player.gender),
        birthDate: player.birthDate.trim(),
        province: player.province.trim(),
        city: player.city.trim(),
        source: player.source.trim()
      };
    })
    .filter((player) => player.name)
    .filter((player) => {
      if (seen.has(player.id)) return false;
      seen.add(player.id);
      return true;
    });
}

async function seedMofang602Players() {
  const pool = getPostgresPool();
  const existing = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM weekly_player_library");
  if (Number(existing.rows[0]?.count || 0) > 0) return;

  for (const name of mofang602Names) {
    await pool.query(
      `INSERT INTO weekly_player_library (id, name, source)
       VALUES ($1,$2,$3)
       ON CONFLICT (id) DO NOTHING`,
      [createSeedId(name), name, "mofang123 第334周三阶表"]
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
    gender: normalizeGender(row.gender),
    birthDate: row.birth_date || "",
    province: row.province || "",
    city: row.city || "",
    source: row.source || "",
    updatedAt: row.updated_at
  };
}

function normalizeGender(gender: string): WeeklyLibraryGender {
  if (gender === "男" || gender === "女") return gender;
  return "";
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
