import { competitions, getCompetitionDisplayName } from "@/lib/data";
import { getLiaoningCompetitions } from "@/lib/liaoning-competitions";
import type { EventListRow } from "@/lib/event-types";

export type { EventCategory, EventListRow } from "@/lib/event-types";
export { eventCategoryLabels, eventCategoryOrder } from "@/lib/event-types";

// 2026 全国魔方运动巡回赛站点（与「国赛专题」页同步），列表里点击进入专题页。
const nationalStops: { name: string; city: string; date: string }[] = [
  { name: "总决赛 · 北京", city: "北京", date: "2026-11-27" },
  { name: "第七站 · 湖北随州", city: "湖北随州", date: "2026-10-31" },
  { name: "第六站 · 福建莆田", city: "福建莆田", date: "2026-09-12" },
  { name: "第五站 · 陕西富平", city: "陕西富平", date: "2026-07-25" },
  { name: "第四站 · 安徽天长", city: "安徽天长", date: "2026-06-27" },
  { name: "第三站 · 浙江丽水", city: "浙江丽水", date: "2026-06-13" },
  { name: "第二站 · 湖南娄底", city: "湖南娄底", date: "2026-05-03" },
  { name: "第一站 · 江苏盐城", city: "江苏盐城", date: "2026-04-18" }
];

function normalizeSortDate(date: string) {
  return date.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || `${date}-00-00`.slice(0, 10) || "0000-00-00";
}

/**
 * Unified competition list combining hand-curated city/province events (static),
 * the full set of WCA competitions Liaoning players attended (PostgreSQL sync),
 * and the national tour stops (linking to the national topic page). Degrades
 * gracefully (WCA rows simply absent) when the database is unavailable.
 */
export async function getEventList(): Promise<EventListRow[]> {
  const rows: EventListRow[] = [];

  for (const competition of competitions) {
    if (competition.category !== "shenyang-city-open" && competition.category !== "liaoning-province-open") {
      continue; // WCA-official static entries are superseded by the live sync below
    }
    rows.push({
      id: `static-${competition.id}`,
      date: competition.date,
      sortDate: normalizeSortDate(competition.date),
      category: competition.category === "liaoning-province-open" ? "province" : "city",
      name: getCompetitionDisplayName(competition),
      location: [competition.city, competition.venue].filter(Boolean).join(" · ") || competition.province,
      href: `/competitions/${competition.slug}`,
      external: false
    });
  }

  const wcaCompetitions = await getLiaoningCompetitions();
  for (const competition of wcaCompetitions) {
    rows.push({
      id: `wca-${competition.id}`,
      date: competition.date,
      sortDate: normalizeSortDate(competition.date),
      category: "wca",
      name: competition.nameZh,
      location: competition.city || competition.country || "",
      href: `https://www.worldcubeassociation.org/competitions/${competition.id}`,
      external: true
    });
  }

  for (const stop of nationalStops) {
    rows.push({
      id: `national-${stop.date}`,
      date: stop.date,
      sortDate: normalizeSortDate(stop.date),
      category: "national",
      name: stop.name,
      location: stop.city,
      href: "/national-events",
      external: false
    });
  }

  rows.sort((a, b) => b.sortDate.localeCompare(a.sortDate) || a.name.localeCompare(b.name, "zh-Hans-CN"));
  return rows;
}
