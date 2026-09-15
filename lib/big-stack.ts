import { getPostgresPool } from "@/lib/postgres";

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
  meetId: string | null;
  meetTitle: string;
  sourceLabel: string;
  rank: number;
};

export function isBigStackEvent(value: string): value is BigStackEventId {
  return BIG_STACK_EVENTS.some((event) => event.id === value);
}

export function getBigStackEventName(eventId: string) {
  return BIG_STACK_EVENTS.find((event) => event.id === eventId)?.name || "三阶";
}

export async function listBigStackRecords(eventId: BigStackEventId): Promise<BigStackRecord[]> {
  const pool = getPostgresPool();
  const { rows } = await pool.query<{
    id: string; name: string; event_code: BigStackEventId; solve_count: number;
    meet_id: string | null; meet_title: string | null; source_label: string;
  }>(
    `SELECT record.id, record.name, record.event_code, record.solve_count, record.meet_id,
            meet.title AS meet_title, record.source_label
       FROM weekly_big_stack_records record
       LEFT JOIN weekly_meets meet ON meet.id = record.meet_id
      WHERE record.event_code = $1
      ORDER BY record.solve_count DESC, record.name ASC`,
    [eventId]
  );
  let previousCount: number | null = null;
  let previousRank = 0;
  return rows.map((row, index) => {
    const rank = previousCount === row.solve_count ? previousRank : index + 1;
    previousCount = row.solve_count;
    previousRank = rank;
    return {
      id: row.id,
      name: row.name,
      eventId: row.event_code,
      solveCount: row.solve_count,
      meetId: row.meet_id,
      meetTitle: row.meet_title || "",
      sourceLabel: row.source_label || "",
      rank
    };
  });
}

export async function createBigStackRecord(input: { name: string; eventId: BigStackEventId; solveCount: number; meetId: string }) {
  const pool = getPostgresPool();
  const id = `big-stack-${crypto.randomUUID()}`;
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO weekly_big_stack_records (id, name, event_code, solve_count, meet_id, source_label, updated_at)
     VALUES ($1, $2, $3, $4, $5, '', now()) RETURNING id`,
    [id, input.name.trim(), input.eventId, input.solveCount, input.meetId]
  );
  return rows[0].id;
}

export async function updateBigStackRecord(id: string, input: { name: string; eventId: BigStackEventId; solveCount: number; meetId: string | null; sourceLabel: string }) {
  const pool = getPostgresPool();
  const result = await pool.query(
    `UPDATE weekly_big_stack_records
        SET name = $2, event_code = $3, solve_count = $4, meet_id = $5, source_label = $6, updated_at = now()
      WHERE id = $1`,
    [id, input.name.trim(), input.eventId, input.solveCount, input.meetId, input.sourceLabel.trim()]
  );
  if (!result.rowCount) throw new Error("未找到这条大堆记录");
}

export async function deleteBigStackRecord(id: string) {
  const pool = getPostgresPool();
  const result = await pool.query(`DELETE FROM weekly_big_stack_records WHERE id = $1`, [id]);
  if (!result.rowCount) throw new Error("未找到这条大堆记录");
}
