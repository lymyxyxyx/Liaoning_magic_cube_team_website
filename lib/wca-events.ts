export const WCA_EVENTS = [
  { id: "333", name: "三阶", englishName: "3x3 Cube" },
  { id: "222", name: "二阶", englishName: "2x2 Cube" },
  { id: "444", name: "四阶", englishName: "4x4 Cube" },
  { id: "555", name: "五阶", englishName: "5x5 Cube" },
  { id: "666", name: "六阶", englishName: "6x6 Cube" },
  { id: "777", name: "七阶", englishName: "7x7 Cube" },
  { id: "333oh", name: "单手", englishName: "3x3 One-Handed" },
  { id: "333bf", name: "三盲", englishName: "3x3 Blindfolded" },
  { id: "333fm", name: "最少步", englishName: "3x3 Fewest Moves" },
  { id: "333mbf", name: "多盲", englishName: "3x3 Multi-Blind" },
  { id: "333ft", name: "脚拧", englishName: "3x3 With Feet" },
  { id: "clock", name: "魔表", englishName: "Clock" },
  { id: "minx", name: "五魔方", englishName: "Megaminx" },
  { id: "pyram", name: "金字塔", englishName: "Pyraminx" },
  { id: "skewb", name: "斜转", englishName: "Skewb" },
  { id: "sq1", name: "SQ-1", englishName: "Square-1" },
  { id: "444bf", name: "四盲", englishName: "4x4 Blindfolded" },
  { id: "555bf", name: "五盲", englishName: "5x5 Blindfolded" },
  { id: "mirror", name: "镜面", englishName: "Mirror Cube" },
  { id: "maple", name: "枫叶", englishName: "Maple Leaf" },
  { id: "individual", name: "个人全能", englishName: "Individual All-Around" },
  { id: "team", name: "团体赛", englishName: "Team" },
  { id: "bigstack100", name: "大堆（100个）", englishName: "Big Stack 100" },
  { id: "bigstack300", name: "大堆（300个）", englishName: "Big Stack 300" }
] as const;

export type WcaEventId = (typeof WCA_EVENTS)[number]["id"];

export function getWcaEventName(eventId: string) {
  return WCA_EVENTS.find((event) => event.id === eventId)?.name || eventId;
}

export function isWcaEventId(eventId: string): eventId is WcaEventId {
  return WCA_EVENTS.some((event) => event.id === eventId);
}

export function getWcaEventLabel(eventId: string) {
  const event = WCA_EVENTS.find((item) => item.id === eventId);
  return event ? `${event.name} / ${event.englishName}` : eventId;
}
