import { getPostgresPool } from "@/lib/postgres";
import { updateBigStackRecord } from "@/lib/big-stack";
import { assertWeeklyResultVersion } from "@/lib/weekly-result-version";
import { updateWeeklyPlayerIdentity } from "@/lib/weekly-player-identity";

type RecordEdit = Parameters<typeof updateBigStackRecord>[1];
export async function editBigStackRecordDirectly(id: string, input: RecordEdit & { weeklyNumber?: number | null; playerVersion?: string }) {
  if (input.weeklyNumber !== null && (!Number.isInteger(input.weeklyNumber) || (input.weeklyNumber || 0) < 1)) throw new Error("周赛编号应为已有编号，可留空");
  const client = await getPostgresPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE weekly_long_card_profiles IN SHARE ROW EXCLUSIVE MODE");
    await client.query("LOCK TABLE weekly_player_wca_matches IN EXCLUSIVE MODE");
    await client.query("LOCK TABLE weekly_big_stack_records IN EXCLUSIVE MODE");
    const original = await client.query<{version: string}>("SELECT updated_at::text AS version FROM weekly_big_stack_records WHERE id=$1 FOR UPDATE", [id]);
    assertWeeklyResultVersion(original.rows[0]?.version, input.expectedVersion);
    let playerId: string | undefined;
    if (input.weeklyNumber !== null) {
      const selected = await client.query<{id: string; wca_id: string; wca_id_confirmed: boolean; version: string}>("SELECT id,wca_id,wca_id_confirmed,updated_at::text AS version FROM weekly_player_library WHERE weekly_number=$1 AND source IN ('players_excel_import','admin_manual') FOR UPDATE", [input.weeklyNumber]);
      const player = selected.rows[0];
      if (!player) throw new Error("周赛编号不存在，请填写已有编号；无编号可留空");
      assertWeeklyResultVersion(player.version, input.playerVersion || "");
      playerId = player.id;
      const wcaId = input.wcaId?.trim().toUpperCase() || "";
      if (wcaId !== player.wca_id) await updateWeeklyPlayerIdentity({ id: player.id, expectedVersion: player.version, weeklyNumber: input.weeklyNumber!, wcaId, wcaIdConfirmed: Boolean(wcaId), reason: input.reason || "大堆榜直接编辑 WCA 绑定" }, client, id);
    }
    // Shared identity changes may refresh this bound record's timestamp.
    const current = await client.query<{version: string}>("SELECT updated_at::text AS version FROM weekly_big_stack_records WHERE id=$1", [id]);
    const record = await updateBigStackRecord(id, { ...input, playerId, expectedVersion: current.rows[0].version, reason: input.reason?.trim() || "大堆榜直接编辑" }, client);
    await client.query("COMMIT");
    return record;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
