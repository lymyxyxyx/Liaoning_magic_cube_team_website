import { getPostgresPool } from "@/lib/postgres";

export type BigStackRecord = {
  id?: string;
  name: string;
  count: number;
  updatedAt?: string;
};

export const bigStackIntro =
  "以下为个人单轮大堆纪录，即1小时内还原三阶魔方最高数量。每次刷新个人纪录，即可获得1积分奖励！";

export const bigStackRecords: BigStackRecord[] = [
  { name: "董一泽", count: 396 },
  { name: "韩沐遥", count: 338 },
  { name: "李祐萱", count: 338 },
  { name: "徐雅芊", count: 335 },
  { name: "韩业臻", count: 319 },
  { name: "王一桐", count: 312 },
  { name: "李雨桐", count: 283 },
  { name: "李易庭洋", count: 272 },
  { name: "孟思竣", count: 272 },
  { name: "王皓泽", count: 270 },
  { name: "姚孟妤", count: 261 },
  { name: "王冠泽", count: 260 },
  { name: "张皓博", count: 260 },
  { name: "郭铠希", count: 258 },
  { name: "朱斐然", count: 255 },
  { name: "于茂洋", count: 251 },
  { name: "王芮菡", count: 248 },
  { name: "高云淼", count: 238 },
  { name: "姚云翰", count: 236 },
  { name: "王颢喆", count: 236 },
  { name: "王韩俊", count: 235 },
  { name: "韩梓峰", count: 234 },
  { name: "郑名扬", count: 233 },
  { name: "郭昕宁", count: 232 },
  { name: "文广赫", count: 231 },
  { name: "白福德", count: 230 },
  { name: "韩睿轩", count: 227 },
  { name: "张乐翔", count: 226 },
  { name: "刘欣灿", count: 226 },
  { name: "赵翰轩", count: 225 },
  { name: "卫子豪", count: 224 },
  { name: "宋慧易", count: 223 },
  { name: "华争", count: 221 },
  { name: "孙一鸣", count: 221 },
  { name: "程尚山", count: 220 },
  { name: "张毕梵", count: 219 },
  { name: "隋斌帅", count: 217 },
  { name: "赵劲骁", count: 215 },
  { name: "王星欢", count: 215 },
  { name: "付衍杰", count: 213 },
  { name: "韩迦南", count: 213 },
  { name: "田澄云", count: 213 },
  { name: "赵星睿", count: 211 },
  { name: "蒋茗朗", count: 211 },
  { name: "张皓博", count: 210 },
  { name: "丁恩睿", count: 208 },
  { name: "范继耀", count: 208 },
  { name: "孙安然", count: 208 },
  { name: "徐可心", count: 207 },
  { name: "祁业豫", count: 204 },
  { name: "李宗豪", count: 203 },
  { name: "罗一轩", count: 202 },
  { name: "夏懿豪", count: 201 },
  { name: "曹悦阳", count: 201 },
  { name: "孟维立", count: 200 },
  { name: "冰馨妍", count: 200 },
  { name: "宋晋之", count: 199 },
  { name: "王子尧", count: 198 },
  { name: "张梓阳", count: 198 },
  { name: "芮阳巴", count: 196 },
  { name: "安薇彤", count: 195 },
  { name: "刘乙辰", count: 193 },
  { name: "杨英杰", count: 192 },
  { name: "王小翔", count: 190 },
  { name: "郑天宇", count: 189 },
  { name: "陈芊燃", count: 188 },
  { name: "蔡业达", count: 186 },
  { name: "齐梓恒", count: 186 },
  { name: "马可为", count: 185 },
  { name: "蒋璟迪", count: 184 },
  { name: "赵梓霖", count: 184 },
  { name: "籍明轩", count: 183 },
  { name: "刘明芳", count: 182 },
  { name: "郭宴弦", count: 181 },
  { name: "姜梓森", count: 181 },
  { name: "李梓豪", count: 180 },
  { name: "孟益恒", count: 180 },
  { name: "姚孟妤", count: 178 },
  { name: "赵昱鑫", count: 178 },
  { name: "岳锦之", count: 177 }
];

export function getRankedBigStackRecords(records: BigStackRecord[] = bigStackRecords) {
  return [...records].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-Hans-CN"));
}

export async function ensureBigStackTable() {
  const pool = getPostgresPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS big_stack_records (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS big_stack_records_count_idx ON big_stack_records (count DESC)");
}

export async function listBigStackRecords() {
  await ensureBigStackTable();
  const pool = getPostgresPool();
  const existing = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM big_stack_records");
  if (Number(existing.rows[0]?.count || 0) === 0) await seedBigStackRecords();
  const { rows } = await pool.query<{ id: string; name: string; count: number; updated_at: string }>(
    "SELECT id, name, count, updated_at FROM big_stack_records ORDER BY count DESC, name ASC"
  );
  return rows.map((row) => ({ id: row.id, name: row.name, count: Number(row.count), updatedAt: row.updated_at }));
}

export async function saveBigStackRecords(records: BigStackRecord[]) {
  await ensureBigStackTable();
  const normalized = normalizeBigStackRecords(records);
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ids = normalized.map((record) => record.id);
    await client.query("DELETE FROM big_stack_records WHERE NOT (id = ANY($1::text[]))", [ids]);
    for (const record of normalized) {
      await client.query(
        `INSERT INTO big_stack_records (id, name, count, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, count = EXCLUDED.count, updated_at = now()`,
        [record.id, record.name, record.count]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return listBigStackRecords();
}

async function seedBigStackRecords() {
  const pool = getPostgresPool();
  for (const record of normalizeBigStackRecords(bigStackRecords)) {
    await pool.query(
      `INSERT INTO big_stack_records (id, name, count, updated_at)
       VALUES ($1, $2, $3, now()) ON CONFLICT (name) DO UPDATE SET count = GREATEST(big_stack_records.count, EXCLUDED.count), updated_at = now()`,
      [record.id, record.name, record.count]
    );
  }
}

function normalizeBigStackRecords(records: BigStackRecord[]) {
  const byName = new Map<string, BigStackRecord>();
  for (const record of records) {
    const name = record.name.trim();
    const count = Math.floor(Number(record.count));
    if (!name || !Number.isFinite(count) || count < 0) continue;
    const current = byName.get(name);
    if (!current || count > current.count) byName.set(name, { id: record.id || createBigStackId(name), name, count });
  }
  return [...byName.values()];
}

function createBigStackId(name: string) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "");
  return `big-stack-${slug || Date.now().toString(36)}`;
}
