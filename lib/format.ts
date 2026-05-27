export function formatWcaExportDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function formatRankCell(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : "-";
}

const wcaEventChineseNames: Record<string, string> = {
  "333": "三阶魔方",
  "222": "二阶魔方",
  "444": "四阶魔方",
  "555": "五阶魔方",
  "666": "六阶魔方",
  "777": "七阶魔方",
  "333bf": "三阶盲拧",
  "333fm": "三阶最少步",
  "333oh": "三阶单手",
  "333ft": "三阶脚拧",
  "minx": "五魔方",
  "pyram": "金字塔",
  "clock": "魔表",
  "skewb": "斜转",
  "sq1": "SQ1",
  "444bf": "四阶盲拧",
  "555bf": "五阶盲拧",
  "333mbf": "三阶多盲",
  "magic": "八板",
  "mmagic": "十二板",
  "333ni": "三阶魔方（无检查）"
};

export function formatWcaEventName(id: string, englishName: string) {
  const chinese = wcaEventChineseNames[id] || englishName;
  return `${id}（${chinese}）`;
}
