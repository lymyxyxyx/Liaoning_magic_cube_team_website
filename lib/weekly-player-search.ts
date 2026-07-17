import { pinyin } from "pinyin-pro";

type SearchableWeeklyPlayer = {
  name: string;
  wcaId?: string;
};

export function matchesWeeklyPlayerQuery(player: SearchableWeeklyPlayer, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const chineseName = player.name.match(/[\u3400-\u9fff]/g)?.join("") || "";
  const fullPinyin = chineseName ? pinyin(chineseName, { toneType: "none", type: "array" }).join("").toLowerCase() : "";

  return (
    player.name.includes(query.trim()) ||
    (player.wcaId || "").toLowerCase().includes(normalizedQuery) ||
    getPinyinInitials(chineseName || player.name).includes(normalizedQuery) ||
    fullPinyin.includes(normalizedQuery)
  );
}

export function getPinyinInitials(name: string) {
  return pinyin(name, { pattern: "first", toneType: "none", type: "array" }).join("").toLowerCase();
}
