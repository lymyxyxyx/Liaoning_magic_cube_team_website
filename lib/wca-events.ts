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
  { id: "bigstack333", name: "三阶", englishName: "3x3 Big Stack" },
  { id: "bigstack222", name: "二阶", englishName: "2x2 Big Stack" },
  { id: "bigstackpyram", name: "金字塔", englishName: "Pyraminx Big Stack" },
  { id: "bigstackmaple", name: "枫叶", englishName: "Maple Leaf Big Stack" },
  { id: "bigstackmirror", name: "镜面", englishName: "Mirror Big Stack" }
] as const;

// 周赛当前开放项目。其它 WCA_EVENTS 保留在后台配置中，后续可直接启用。
export const BIG_STACK_EVENT_IDS = ["bigstack333", "bigstack222", "bigstackpyram", "bigstackmaple", "bigstackmirror"] as const;

// 大堆先展示已有数据的三阶、镜面；另三个子项已建好，后续启用即可。
export const WEEKLY_VISIBLE_BIG_STACK_EVENT_IDS = ["bigstack333", "bigstackmirror"] as const;
export const WEEKLY_DEFAULT_EVENT_IDS = ["333", "222", "pyram", "maple", "mirror", "individual", ...WEEKLY_VISIBLE_BIG_STACK_EVENT_IDS] as const;

export const WEEKLY_DEFAULT_EVENTS = WEEKLY_DEFAULT_EVENT_IDS
  .map((eventId) => WCA_EVENTS.find((event) => event.id === eventId))
  .filter((event): event is (typeof WCA_EVENTS)[number] => Boolean(event));

export type WcaEventId = (typeof WCA_EVENTS)[number]["id"];

export function isBigStackEventId(eventId: string) {
  return (BIG_STACK_EVENT_IDS as readonly string[]).includes(eventId);
}

export function getWeeklyEventGroupName(eventId: string) {
  return isBigStackEventId(eventId) ? "大堆" : null;
}

export function isWeeklySingleAttemptEvent(eventId: string) {
  return eventId === "individual" || isBigStackEventId(eventId);
}

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
