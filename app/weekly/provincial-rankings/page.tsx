import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";
import { listWeeklyProvincialRankingEvents, listWeeklyProvincialRankings, WEEKLY_PROVINCIAL_RANKING_NOTE } from "@/lib/weekly-provincial-ranking";
import { getWeeklyMeetMenuLabel } from "@/lib/weekly-meet-label";

export const dynamic = "force-dynamic";

function formatAverage(value: number) {
  return value.toFixed(2);
}

function formatMeetPeriod(value: string) {
  const dates = [...value.matchAll(/20\d{2}-(\d{1,2})-(\d{1,2})/g)];
  if (dates.length >= 2) return `${Number(dates[0][1])}月${Number(dates[0][2])}日–${Number(dates[dates.length - 1][1])}月${Number(dates[dates.length - 1][2])}日`;
  return value;
}

export default async function WeeklyProvincialRankingsPage({ searchParams }: { searchParams: Promise<{ event?: string; ageGroup?: string }> }) {
  if (!isWeeklyCompetitionEnabled()) notFound();
  const events = await listWeeklyProvincialRankingEvents();
  const params = await searchParams;
  const selectedEvent = events.find((event) => event.eventCode === params.event)?.eventCode || events.find((event) => event.eventCode === "333")?.eventCode || events[0]?.eventCode;
  const rankings = selectedEvent ? await listWeeklyProvincialRankings(selectedEvent) : [];
  const ageGroups = [...new Set(rankings.map((row) => row.ageGroup).filter(Boolean))].sort((left, right) => left.localeCompare(right, "zh-CN", { numeric: true }));
  const selectedAgeGroup = ageGroups.includes(params.ageGroup || "") ? params.ageGroup || "" : "";
  const visibleRankings = selectedAgeGroup ? rankings.filter((row) => row.ageGroup === selectedAgeGroup) : rankings;
  const selectedName = events.find((event) => event.eventCode === selectedEvent)?.eventName || "周赛";

  return <>
    <PageHero className="page-hero--compact weekly-results-page-hero" label="辽宁线上周赛" title="辽宁省周赛榜" actions={<Link className="button" href="/weekly">返回周赛</Link>}>
      {WEEKLY_PROVINCIAL_RANKING_NOTE}
    </PageHero>
    <section className="container section weekly-provincial-ranking-page">
      <nav className="weekly-provincial-ranking-tabs" aria-label="省榜项目">
        {events.map((event) => <Link className={event.eventCode === selectedEvent ? "is-active" : ""} href={`/weekly/provincial-rankings?event=${encodeURIComponent(event.eventCode)}`} key={event.eventCode}>{event.eventName}</Link>)}
      </nav>
      <div className="weekly-provincial-ranking-note"><strong>{selectedName}平均成绩榜</strong><span>每位选手仅保留纳入范围内的历史最好平均。</span></div>
      <nav className="weekly-provincial-ranking-tabs weekly-provincial-age-tabs" aria-label="年龄组筛选">
        <Link className={!selectedAgeGroup ? "is-active" : ""} href={`/weekly/provincial-rankings?event=${encodeURIComponent(selectedEvent || "333")}`}>全部组别</Link>
        {ageGroups.map((group) => <Link className={group === selectedAgeGroup ? "is-active" : ""} href={`/weekly/provincial-rankings?event=${encodeURIComponent(selectedEvent || "333")}&ageGroup=${encodeURIComponent(group)}`} key={group}>{group}</Link>)}
      </nav>
      <div className="result-table-wrap"><table className="result-table weekly-provincial-ranking-table"><thead><tr><th>辽宁省排名</th><th>选手编号</th><th>姓名</th><th>组别</th><th>性别</th><th>WCA ID</th><th>最好平均</th><th>达成周赛</th></tr></thead><tbody>
        {visibleRankings.map((row) => <tr key={row.playerId}><td className="score-strong">#{row.rank}</td><td>{row.weeklyNumber ?? ""}</td><td>{row.playerSlug ? <Link className="table-person-link" href={`/people/${row.playerSlug}`}>{row.playerName}</Link> : row.playerName}</td><td>{row.ageGroup}</td><td>{row.gender}</td><td className="weekly-provincial-wca-id">{row.wcaId}</td><td className="score-strong">{formatAverage(row.average)}</td><td className="weekly-provincial-meet-cell">{getWeeklyMeetMenuLabel(row.meetTitle)} · {formatMeetPeriod(row.dateLabel)}</td></tr>)}
        {!visibleRankings.length ? <tr><td colSpan={8}>当前年龄组暂无可计入的周赛平均成绩。</td></tr> : null}
      </tbody></table></div>
    </section>
  </>;
}
