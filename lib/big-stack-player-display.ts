import { getPostgresPool } from "@/lib/postgres";
import { enrichLocalProfiles, readLocalProfiles } from "@/lib/local-profile-store";
import type { BigStackRecord } from "@/lib/big-stack";

export type BigStackPlayerIdentity = { id: string; name: string; weeklyNumber?: number; wcaId: string; gender: string; version: string };
export type BigStackRegionalIdentity = { name: string; wcaId: string; gender?: string };
const exactName = (name: string) => (name.match(/\(([\u3400-\u9fff]+)\)/)?.[1] || name).trim().replace(/\s+/g, " ");
function unique<T>(values: T[], key: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) { const k = key(value); if (k) groups.set(k, [...(groups.get(k) || []), value]); }
  return (key: string) => { const values = groups.get(key); return values?.length === 1 ? values[0] : undefined; };
}

export function matchBigStackPlayerDisplay(records: BigStackRecord[], players: BigStackPlayerIdentity[], profiles: BigStackRegionalIdentity[]) {
  const byPlayerId = unique(players, player => player.id);
  const byPlayerName = unique(players, player => exactName(player.name));
  const byPlayerWca = unique(players, player => player.wcaId.toUpperCase());
  const byProfileName = unique(profiles, profile => exactName(profile.name));
  const byProfileWca = unique(profiles, profile => profile.wcaId.toUpperCase());
  return records.map(record => {
    const matchedPlayer = record.playerId ? byPlayerId(record.playerId) : record.wcaId ? byPlayerWca(record.wcaId.toUpperCase()) : byPlayerName(exactName(record.name));
    const player = matchedPlayer && exactName(matchedPlayer.name) === exactName(record.name) ? matchedPlayer : undefined;
    const wcaId = record.wcaId || player?.wcaId || "";
    const ambiguousName = !record.playerId && !record.wcaId && players.filter(candidate => exactName(candidate.name) === exactName(record.name)).length > 1;
    const conflict = Boolean(record.wcaId && player?.wcaId && record.wcaId.toUpperCase() !== player.wcaId.toUpperCase());
    // Explicit identifiers never fall back to a same-name person when unresolved.
    const matchedProfile = conflict || ambiguousName || (record.playerId && !player && !wcaId) ? undefined : wcaId ? byProfileWca(wcaId.toUpperCase()) : byProfileName(exactName(record.name));
    const profile = matchedProfile && exactName(matchedProfile.name) === exactName(record.name) ? matchedProfile : undefined;
    const genders = [player?.gender, profile?.gender].filter(gender => gender === "男" || gender === "女");
    const gender = record.genderOverride || (!conflict && !ambiguousName && new Set(genders).size === 1 ? genders[0] : "未知");
    return { ...record, weeklyNumber: conflict ? undefined : player?.weeklyNumber, matchedWcaId: profile?.wcaId || "", gender,
      matchedPlayerId: conflict ? undefined : player?.id, playerVersion: conflict ? undefined : player?.version };
  });
}

export async function decorateBigStackRecords(records: BigStackRecord[]) {
  const [result, profiles] = await Promise.all([
    getPostgresPool().query<{id: string; name: string; weekly_number: number; wca_id: string; gender: string; version: string}>("SELECT id,name,weekly_number,wca_id,gender,updated_at::text AS version FROM weekly_player_library WHERE source IN ('players_excel_import','admin_manual')"),
    readLocalProfiles().then(enrichLocalProfiles).catch(() => [])
  ]);
  const players = result.rows.map(row => ({ id: row.id, name: row.name, weeklyNumber: row.weekly_number, wcaId: row.wca_id || "", gender: row.gender, version: row.version }));
  const regional = profiles.filter(profile => profile.visible && profile.province === "辽宁" && profile.wcaId).map(profile => ({ name: profile.name, wcaId: profile.wcaId!, gender: profile.gender }));
  return matchBigStackPlayerDisplay(records, players, regional);
}
