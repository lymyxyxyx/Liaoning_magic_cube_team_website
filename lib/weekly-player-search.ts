import { pinyin } from "pinyin-pro";

type SearchableWeeklyPlayer = {
  name: string;
  wcaId?: string;
};

export function matchesWeeklyPlayerQuery(player: SearchableWeeklyPlayer, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return (
    player.name.includes(query.trim()) ||
    (player.wcaId || "").toLowerCase().includes(normalizedQuery) ||
    getPinyinInitials(player.name).includes(normalizedQuery)
  );
}

export function getPinyinInitials(name: string) {
  return pinyin(name, { pattern: "first", toneType: "none", type: "array" }).join("").toLowerCase();
}
