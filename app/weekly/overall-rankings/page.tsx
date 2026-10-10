import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";
import { formatCountResult, formatResult, secondsToResultValue } from "@/lib/weekly-result-utils";
import { listWeeklyOverallResultEvents, listWeeklyOverallResults, WEEKLY_OVERALL_RESULTS_START } from "@/lib/weekly-overall-results";

export const dynamic = "force-dynamic";

export default async function WeeklyOverallRankingsPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  if (!isWeeklyCompetitionEnabled()) notFound();
  const [events, params] = await Promise.all([listWeeklyOverallResultEvents(), searchParams]);
  const selected = events.find((event) => event.eventCode === params.event) || events[0];
  const rankings = selected ? await listWeeklyOverallResults(selected) : [];

  return <>
    <PageHero className="page-hero--compact weekly-results-page-hero" label="辽宁线上周赛" title="周赛成绩总榜" actions={<Link className="button" href="/weekly">返回周赛</Link>}>
      汇总第 {WEEKLY_OVERALL_RESULTS_START} 周起已录入的周赛成绩，未来新增成绩会自动纳入。按项目展示选手历史最好成绩，不折算积分；不同项目分别排名。
    </PageHero>
    <section className="container section weekly-provincial-ranking-page">
      <nav className="weekly-provincial-ranking-tabs" aria-label="周赛总榜项目">
        {events.map((event) => <Link className={event.eventCode === selected?.eventCode ? "is-active" : ""} href={`/weekly/overall-rankings?event=${encodeURIComponent(event.eventCode)}`} key={event.eventCode}>{event.eventName}</Link>)}
      </nav>
      {selected ? <>
        <div className="weekly-provincial-ranking-note"><strong>{selected.eventName}成绩排名</strong><span>{selected.countEvent ? "每人取最高还原数量。" : selected.format === "best1" ? "每人取历史最好单次成绩。" : "每人取历史最好平均成绩。"}参赛期数按所有项目合并统计。</span></div>
        <div className="result-table-wrap"><table className="result-table weekly-provincial-ranking-table"><thead><tr><th>排名</th><th>周赛编号</th><th>姓名</th><th>性别</th><th>WCA ID</th><th>{selected.countEvent ? "最好数量" : selected.format === "best1" ? "最好单次" : "最好平均"}</th><th>参赛期数</th><th>最佳成绩周赛</th></tr></thead><tbody>
          {rankings.map((row) => <tr key={row.playerId}><td className="score-strong">#{row.rank}</td><td>{row.weeklyNumber ?? ""}</td><td>{row.playerName}</td><td>{row.gender}</td><td className="weekly-provincial-wca-id">{row.wcaId}</td><td className="score-strong">{selected.countEvent ? formatCountResult(Math.round(row.score * 100)) : formatResult(secondsToResultValue(row.score))}</td><td>{row.participationWeeks}</td><td className="weekly-provincial-meet-cell">第{row.weekNumber}周 · {row.meetTitle}</td></tr>)}
          {!rankings.length ? <tr><td colSpan={8}>第 {WEEKLY_OVERALL_RESULTS_START} 周起暂未录入该项目的有效成绩。</td></tr> : null}
        </tbody></table></div>
      </> : <p className="empty-state">第 {WEEKLY_OVERALL_RESULTS_START} 周起暂未录入周赛成绩。</p>}
    </section>
  </>;
}
