import { listWeeklyMeetEventConfigs, listWeeklyResults, type WeeklyMeetOption } from "@/lib/weekly-entry-store";
import { formatResult } from "@/lib/weekly-result-utils";
import { getWcaEventName } from "@/lib/wca-events";

export async function WeeklyCurrentResults({ meet }: { meet: WeeklyMeetOption }) {
  const configs = await listWeeklyMeetEventConfigs(meet.id);
  const enabled = configs.filter((config) => config.enabled);
  const eventResults = await Promise.all(enabled.map(async (config) => ({ config, results: await listWeeklyResults(meet.id, config.eventId, config.format) })));
  const participantCount = new Set(eventResults.flatMap((item) => item.results.map((result) => result.player.id))).size;
  const three = eventResults.find((item) => item.config.eventId === "333")?.results || [];
  return <section className="container section weekly-current-results">
    <div className="weekly-current-results-heading"><div><span className="eyebrow">本周实时成绩</span><h2>{meet.title}</h2><p>{meet.dateLabel} · 成绩会在管理员保存后即时更新。</p></div></div>
    <div className="weekly-summary-grid"><div className="stat"><strong>{participantCount}</strong><span>已录入选手</span></div><div className="stat"><strong>{three[0] ? formatResult(three[0].best) : "-"}</strong><span>三阶本周最快</span></div><div className="stat"><strong>{three[0] ? formatResult(three[0].average) : "-"}</strong><span>三阶冠军平均</span></div><div className="stat"><strong>{meet.dateLabel}</strong><span>周赛周期</span></div></div>
    <div className="weekly-current-event-grid">{eventResults.map(({ config, results }) => <section className="weekly-current-event-card" key={config.eventId}><div className="section-header"><div><span className="eyebrow">{config.eventId}</span><h3>{getWcaEventName(config.eventId)}</h3></div><span>{results.length} 人</span></div>{results.length ? <div className="result-table-wrap"><table className="result-table"><thead><tr><th>排名</th><th>姓名</th><th>组别</th><th>平均</th><th>本周最快</th><th>段位</th><th>等级</th></tr></thead><tbody>{results.map((result) => <tr key={result.id}><td>{result.rank}</td><td>{result.player.name}{result.isNewPlayer ? <small className="weekly-new-player-badge">（新）</small> : null}</td><td>{result.player.ageGroup || "待补"}</td><td className="score-strong">{formatResult(result.average)}</td><td>{formatResult(result.best)}</td><td>{result.level || "-"}</td><td>{result.grade || "-"}</td></tr>)}</tbody></table></div> : <p className="empty-state">本项目暂无已录入成绩。</p>}</section>)}</div>
  </section>;
}
