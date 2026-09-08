/**
 * The weekly v2 player domain is deliberately narrower than the archive in
 * weekly_player_library. Keep this predicate centralized: legacy rows remain
 * stored, but are never candidates for current weekly operations.
 */
export const WEEKLY_V2_PLAYER_SOURCES = ["players_excel_import", "admin_manual"] as const;

function column(alias: string, name: string) {
  return alias ? `${alias}.${name}` : name;
}

/** V2 provenance, including a v2 player that an administrator later disabled. */
export function weeklyV2PlayerSourceSql(alias = "") {
  const source = column(alias, "source");
  return `${source} IN ('players_excel_import', 'admin_manual')`;
}

/** The only player set allowed for matching, selection, result writes, and PBs. */
export function weeklyV2ActivePlayerSql(alias = "") {
  return `${column(alias, "status")} = 'active' AND ${weeklyV2PlayerSourceSql(alias)}`;
}

export function isWeeklyV2ActivePlayer(player: { status: string; source: string }) {
  return player.status === "active" && (player.source === "players_excel_import" || player.source === "admin_manual");
}
