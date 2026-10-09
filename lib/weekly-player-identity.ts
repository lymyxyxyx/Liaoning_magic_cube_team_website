import { getPostgresPool } from "@/lib/postgres";
import { weeklyV2PlayerSourceSql } from "@/lib/weekly-player-scope";
import { assertWeeklyResultVersion } from "@/lib/weekly-result-version";

export type WeeklyPlayerIdentity = {
  id: string; name: string; weeklyNumber: number; wcaId: string;
  wcaIdConfirmed: boolean; status: string; version: string;
};
type IdentityRow = { id: string; name: string; weekly_number: number; wca_id: string; wca_id_confirmed: boolean; status: string; version: string };
const columns = "id, name, weekly_number, wca_id, wca_id_confirmed, status, updated_at::text AS version";
const mapIdentity = (row: IdentityRow): WeeklyPlayerIdentity => ({ id: row.id, name: row.name, weeklyNumber: row.weekly_number, wcaId: row.wca_id, wcaIdConfirmed: row.wca_id_confirmed, status: row.status, version: row.version });

export async function listWeeklyPlayerIdentities() {
  const { rows } = await getPostgresPool().query<IdentityRow>(`SELECT ${columns} FROM weekly_player_library WHERE ${weeklyV2PlayerSourceSql()} ORDER BY weekly_number, id`);
  return rows.map(mapIdentity);
}

export function validateWeeklyPlayerIdentity(input: { weeklyNumber: number; wcaId: string; wcaIdConfirmed: boolean; reason: string }) {
  if (!Number.isInteger(input.weeklyNumber) || input.weeklyNumber < 1 || input.weeklyNumber > 999999) throw new Error("周赛编号必须是 1 到 999999 之间的整数");
  if (typeof input.wcaId !== "string" || typeof input.wcaIdConfirmed !== "boolean" || typeof input.reason !== "string") throw new Error("选手信息不正确");
  const wcaId = input.wcaId.trim().toUpperCase();
  if (wcaId && !/^\d{4}[A-Z]{4}\d{2}$/.test(wcaId)) throw new Error("WCA ID 格式应为 2019ABCD01，可留空");
  const reason = input.reason.trim();
  if (!reason || reason.length > 500) throw new Error("请填写修改原因（最多 500 字）");
  return { weeklyNumber: input.weeklyNumber, wcaId, wcaIdConfirmed: Boolean(wcaId && input.wcaIdConfirmed), reason };
}

export async function updateWeeklyPlayerIdentity(input: { id: string; expectedVersion: string; weeklyNumber: number; wcaId: string; wcaIdConfirmed: boolean; reason: string }) {
  const next = validateWeeklyPlayerIdentity(input);
  const client = await getPostgresPool().connect();
  try {
    await client.query("BEGIN");
    // Match long-card creation order; take table locks before library row locks.
    await client.query("LOCK TABLE weekly_long_card_profiles IN SHARE ROW EXCLUSIVE MODE");
    await client.query("LOCK TABLE weekly_player_wca_matches IN EXCLUSIVE MODE");
    await client.query("LOCK TABLE weekly_big_stack_records IN EXCLUSIVE MODE");
    const current = await client.query<IdentityRow>(`SELECT ${columns} FROM weekly_player_library WHERE id=$1 AND ${weeklyV2PlayerSourceSql()} FOR UPDATE`, [input.id]);
    const before = current.rows[0];
    assertWeeklyResultVersion(before?.version, input.expectedVersion);
    const duplicate = await client.query("SELECT id FROM weekly_player_library WHERE id<>$1 AND (weekly_number=$2 OR ($3<>'' AND upper(wca_id)=$3 AND source IN ('players_excel_import','admin_manual'))) LIMIT 1", [input.id, next.weeklyNumber, next.wcaId]);
    if (duplicate.rows[0]) throw new Error("周赛编号或 WCA ID 已被其他选手使用，请选择其他编号或核对绑定");
    if (next.wcaId) {
      const matched = await client.query("SELECT id FROM weekly_player_wca_matches WHERE upper(wca_id)=$1 AND status='confirmed' AND weekly_player_id<>$2 LIMIT 1", [next.wcaId, input.id]);
      if (matched.rows[0]) throw new Error("该 WCA ID 已确认给另一位选手，请先核对已有绑定");
    }
    if (next.wcaId && next.wcaId !== before.wca_id) {
      const conflicts = await client.query("SELECT id FROM weekly_big_stack_records WHERE upper(wca_id)=$1 AND (player_id IS NULL OR player_id<>$2) LIMIT 1", [next.wcaId, input.id]);
      if (conflicts.rows[0]) throw new Error("该 WCA ID 已在大堆榜绑定另一条记录，请先核对或补绑定原记录");
    }
    const updated = await client.query<IdentityRow>(`UPDATE weekly_player_library SET weekly_number=$2, wca_id=$3, wca_id_confirmed=$4, updated_at=clock_timestamp() WHERE id=$1 RETURNING ${columns}`, [input.id, next.weeklyNumber, next.wcaId, next.wcaIdConfirmed]);
    await client.query("UPDATE weekly_long_card_profiles SET wca_id=$2, updated_at=now() WHERE matched_player_id=$1", [input.id, next.wcaId]);
    await client.query(`UPDATE weekly_player_wca_matches SET status=CASE WHEN wca_id=$2 AND $3 THEN 'confirmed' ELSE 'rejected' END, confirmed_at=CASE WHEN wca_id=$2 AND $3 THEN now() ELSE NULL END, updated_at=now() WHERE weekly_player_id=$1`, [input.id, next.wcaId, next.wcaIdConfirmed]);
    if (next.wcaId !== before.wca_id) {
      const records = await client.query<{ id: string; snapshot: unknown }>("SELECT id,to_jsonb(record) AS snapshot FROM weekly_big_stack_records record WHERE player_id=$1", [input.id]);
      for (const record of records.rows) {
        const after = await client.query<{ snapshot: unknown }>("UPDATE weekly_big_stack_records record SET wca_id=$2,updated_at=clock_timestamp() WHERE id=$1 RETURNING to_jsonb(record) AS snapshot", [record.id, next.wcaId]);
        await client.query(`INSERT INTO weekly_big_stack_record_revisions (record_id,action,reason,before_record,after_record,points_awarded) VALUES ($1,'identity',$2,$3::jsonb,$4::jsonb,0)`, [record.id, next.reason, JSON.stringify(record.snapshot), JSON.stringify(after.rows[0].snapshot)]);
      }
    }
    await client.query("INSERT INTO weekly_player_identity_revisions(player_id,before_record,after_record,reason) VALUES ($1,$2::jsonb,$3::jsonb,$4)", [input.id, JSON.stringify(mapIdentity(before)), JSON.stringify(mapIdentity(updated.rows[0])), next.reason]);
    await client.query("COMMIT");
    return mapIdentity(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error && typeof error === "object" && "code" in error && error.code === "23505") throw new Error("周赛编号或 WCA ID 已被其他选手使用");
    throw error;
  } finally { client.release(); }
}
