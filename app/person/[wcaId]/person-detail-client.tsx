"use client";

import Link from "next/link";
import { ExternalLink, Medal, Loader2, User, MapPin, Globe, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { formatWcaResult, formatWcaAttempt } from "@/lib/wca-result-format";

type PersonProfile = {
  wcaId: string;
  name: string;
  countryId: string;
  countryName: string;
  continentId: string;
  gender: string;
  competitionCount: number;
  careerFirst: string | null;
  careerLast: string | null;
  province: string | null;
  city: string | null;
};

type EventRank = {
  eventId: string;
  best: number;
  worldRank: number;
  continentRank: number;
  countryRank: number;
  provinceRank: number | null;
  cityRank: number | null;
};

type MedalCount = {
  eventId: string;
  gold: number;
  silver: number;
  bronze: number;
};

type SolveAttempt = {
  eventId: string;
  solved: number;
  total: number;
};

type CompetitionResult = {
  competitionId: string;
  competitionName: string;
  competitionNameZh?: string | null;
  eventId: string;
  roundTypeId: string;
  pos: number;
  best: number;
  average: number;
  date: string;
  value1: number;
  value2: number;
  value3: number;
  value4: number;
  value5: number;
};

type PersonData = {
  profile: PersonProfile;
  singleRanks: EventRank[];
  averageRanks: EventRank[];
  medals: MedalCount[];
  solveAttempts: SolveAttempt[];
  results: CompetitionResult[];
};

const wcaLink = "https://www.worldcubeassociation.org/persons/";

const roundTypeLabels: Record<string, string> = {
  "1": "初赛",
  "2": "复赛",
  "3": "半决赛",
  "f": "决赛",
  "d": "资格赛",
  "e": "资格赛"
};

const eventChineseNames: Record<string, string> = {
  "333": "三阶魔方", "222": "二阶魔方", "444": "四阶魔方",
  "555": "五阶魔方", "666": "六阶魔方", "777": "七阶魔方",
  "333bf": "三阶盲拧", "333fm": "三阶最少步", "333oh": "三阶单手",
  "333ft": "三阶脚拧", "minx": "五魔方", "pyram": "金字塔",
  "clock": "魔表", "skewb": "斜转", "sq1": "SQ1",
  "444bf": "四阶盲拧", "555bf": "五阶盲拧", "333mbf": "三阶多盲",
  "magic": "八板", "mmagic": "十二板"
};

const allEvents = [
  { id: "333", name: "三阶" }, { id: "222", name: "二阶" },
  { id: "444", name: "四阶" }, { id: "555", name: "五阶" },
  { id: "666", name: "六阶" }, { id: "777", name: "七阶" },
  { id: "333bf", name: "三盲" }, { id: "333fm", name: "最少步" },
  { id: "333oh", name: "单手" }, { id: "clock", name: "魔表" },
  { id: "minx", name: "五魔方" }, { id: "pyram", name: "金字塔" },
  { id: "skewb", name: "斜转" }, { id: "sq1", name: "SQ1" },
  { id: "444bf", name: "四盲" }, { id: "555bf", name: "五盲" },
  { id: "333mbf", name: "多盲" }, { id: "333ft", name: "脚拧" },
  { id: "magic", name: "八板" }, { id: "mmagic", name: "十二板" }
];

function getEventName(id: string) {
  return eventChineseNames[id] || allEvents.find((e) => e.id === id)?.name || id;
}

function getCompetitionDisplayName(result: Pick<CompetitionResult, "competitionName" | "competitionNameZh">) {
  return result.competitionNameZh || result.competitionName;
}

function RankBadge({ value }: { value: number | null }) {
  if (value == null || value <= 0) return <>-</>;
  const highlightClass = value <= 3 ? "rank-badge rank-badge-podium" : value <= 10 ? "rank-badge rank-badge-top10" : "rank-badge";
  return <span className={highlightClass}>{value}</span>;
}

export function PersonDetailClient({ wcaId }: { wcaId: string }) {
  const [data, setData] = useState<PersonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeEvent, setActiveEvent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"byEvent" | "byCompetition">("byEvent");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/person/${wcaId}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "未找到该选手" : "加载失败");
        return res.json();
      })
      .then((json) => {
        setData(json);
        if (json.singleRanks.length > 0) {
          setActiveEvent(json.singleRanks[0].eventId);
        } else if (json.averageRanks.length > 0) {
          setActiveEvent(json.averageRanks[0].eventId);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [wcaId]);

  if (loading) {
    return (
      <div className="person-loading">
        <Loader2 size={24} className="spin" />
        加载中…
      </div>
    );
  }

  if (error || !data) {
    return <div className="person-error">{(error || "未找到该选手")}</div>;
  }

  const { profile, singleRanks, averageRanks, medals, solveAttempts, results } = data;

  const singleByEvent = new Map(singleRanks.map((r) => [r.eventId, r]));
  const averageByEvent = new Map(averageRanks.map((r) => [r.eventId, r]));
  const medalByEvent = new Map(medals.map((m) => [m.eventId, m]));
  const solveByEvent = new Map(solveAttempts.map((s) => [s.eventId, s]));

  const allEventIds = [...new Set([
    ...singleRanks.map((r) => r.eventId),
    ...averageRanks.map((r) => r.eventId)
  ])];

  const totalGold = medals.reduce((sum, m) => sum + m.gold, 0);
  const totalSilver = medals.reduce((sum, m) => sum + m.silver, 0);
  const totalBronze = medals.reduce((sum, m) => sum + m.bronze, 0);

  const resultsByEvent = new Map<string, CompetitionResult[]>();
  for (const r of results) {
    const list = resultsByEvent.get(r.eventId) || [];
    list.push(r);
    resultsByEvent.set(r.eventId, list);
  }

  return (
    <div className="person-detail-page">
      <section className="person-detail-header">
        <div className="person-detail-header-info">
          <h1>{profile.name}</h1>
          <div className="person-detail-id-row">
            <a href={`${wcaLink}${profile.wcaId}`} target="_blank" rel="noopener noreferrer">
              {profile.wcaId} <ExternalLink size={13} />
            </a>
            <span className="person-detail-sep">|</span>
            <Globe size={14} /> {profile.countryName}
            {profile.gender === "m" && <><span className="person-detail-sep">|</span> 男</>}
            {profile.gender === "f" && <><span className="person-detail-sep">|</span> 女</>}
            <span className="person-detail-sep">|</span>
            <Calendar size={14} /> 参赛 {profile.competitionCount} 次
          </div>
          {profile.careerFirst && profile.careerLast && (
            <div className="person-detail-career">
              职业生涯：{profile.careerFirst} — {profile.careerLast}
            </div>
          )}
          {(profile.province || profile.city) && (
            <div className="person-detail-career">
              <MapPin size={14} /> {[profile.city, profile.province].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </section>

      <section className="person-records-section">
        <div className="section-header">
          <h2>当前个人纪录</h2>
        </div>
        <div className="table-wrap">
          <table className="result-table person-records-table">
            <thead>
              <tr>
                <th>项目</th>
                <th>单次</th>
                <th colSpan={5} className="rank-group-header">排名</th>
                <th>平均</th>
                <th colSpan={5} className="rank-group-header">排名</th>
                <th>金</th>
                <th>银</th>
                <th>铜</th>
                <th>成功/次数</th>
              </tr>
              <tr className="rank-sub-header">
                <th></th>
                <th></th>
                <th>城市</th>
                <th>省份</th>
                <th>国家</th>
                <th>洲际</th>
                <th>世界</th>
                <th></th>
                <th>城市</th>
                <th>省份</th>
                <th>国家</th>
                <th>洲际</th>
                <th>世界</th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {allEventIds.map((eventId) => {
                const single = singleByEvent.get(eventId);
                const average = averageByEvent.get(eventId);
                const medal = medalByEvent.get(eventId);
                const solve = solveByEvent.get(eventId);
                return (
                  <tr key={eventId} className={activeEvent === eventId ? "row-active" : ""}>
                    <td className="event-name-cell">{getEventName(eventId)}</td>
                    <td className="result-cell">
                      {single ? formatWcaResult(eventId, single.best, "single") : "-"}
                    </td>
                    <td className="rank-cell">{profile.city && single ? <RankBadge value={single.cityRank} /> : "-"}</td>
                    <td className="rank-cell">{profile.province && single ? <RankBadge value={single.provinceRank} /> : "-"}</td>
                    <td className="rank-cell">{single ? <RankBadge value={single.countryRank} /> : "-"}</td>
                    <td className="rank-cell">{single ? <RankBadge value={single.continentRank} /> : "-"}</td>
                    <td className="rank-cell">{single ? <RankBadge value={single.worldRank} /> : "-"}</td>
                    <td className="result-cell">
                      {average ? formatWcaResult(eventId, average.best, "average") : "-"}
                    </td>
                    <td className="rank-cell">{profile.city && average ? <RankBadge value={average.cityRank} /> : "-"}</td>
                    <td className="rank-cell">{profile.province && average ? <RankBadge value={average.provinceRank} /> : "-"}</td>
                    <td className="rank-cell">{average ? <RankBadge value={average.countryRank} /> : "-"}</td>
                    <td className="rank-cell">{average ? <RankBadge value={average.continentRank} /> : "-"}</td>
                    <td className="rank-cell">{average ? <RankBadge value={average.worldRank} /> : "-"}</td>
                    <td className="medal-cell medal-gold">{medal?.gold || "-"}</td>
                    <td className="medal-cell medal-silver">{medal?.silver || "-"}</td>
                    <td className="medal-cell medal-bronze">{medal?.bronze || "-"}</td>
                    <td className="solve-cell">
                      {solve ? `${solve.solved}/${solve.total}` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="person-medal-summary">
        <div className="section-header">
          <h2>奖牌汇总</h2>
        </div>
        <div className="medal-summary-cards">
          <div className="medal-card medal-card-gold">
            <Medal size={20} />
            <strong>{totalGold}</strong>
            <span>金牌</span>
          </div>
          <div className="medal-card medal-card-silver">
            <Medal size={20} />
            <strong>{totalSilver}</strong>
            <span>银牌</span>
          </div>
          <div className="medal-card medal-card-bronze">
            <Medal size={20} />
            <strong>{totalBronze}</strong>
            <span>铜牌</span>
          </div>
        </div>
      </section>

      <section className="person-results-section">
        <div className="section-header">
          <h2>比赛成绩</h2>
          <div className="view-toggle">
            <button
              className={viewMode === "byEvent" ? "active" : ""}
              onClick={() => setViewMode("byEvent")}
            >
              按项目
            </button>
            <button
              className={viewMode === "byCompetition" ? "active" : ""}
              onClick={() => setViewMode("byCompetition")}
            >
              按比赛
            </button>
          </div>
        </div>

        {viewMode === "byEvent" && (
          <div className="event-tabs">
            {allEventIds.map((eventId) => (
              <button
                key={eventId}
                className={activeEvent === eventId ? "active" : ""}
                onClick={() => setActiveEvent(eventId)}
              >
                {getEventName(eventId)}
              </button>
            ))}
          </div>
        )}

        <div className="table-wrap">
          {viewMode === "byEvent" && activeEvent && (
            <EventResultsTable
              eventId={activeEvent}
              results={resultsByEvent.get(activeEvent) || []}
            />
          )}
          {viewMode === "byCompetition" && (
            <CompetitionResultsTable
              results={results}
              allEventIds={allEventIds}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function EventResultsTable({ eventId, results }: { eventId: string; results: CompetitionResult[] }) {
  if (results.length === 0) return <p className="no-results">暂无成绩记录</p>;

  return (
    <table className="result-table person-results-table">
      <thead>
        <tr>
          <th>比赛</th>
          <th>轮次</th>
          <th>名次</th>
          <th>单次</th>
          <th>平均</th>
          <th>详情</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const detailValues = [r.value1, r.value2, r.value3, r.value4, r.value5]
            .filter((v) => v > 0)
            .map((v) => formatWcaAttempt(eventId, v));
          return (
            <tr key={i}>
              <td className="comp-cell">
                <a
                  href={`https://cubing.com/results/competition/${r.competitionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>
                    <strong>{getCompetitionDisplayName(r)}</strong>
                    {r.competitionNameZh && r.competitionNameZh !== r.competitionName && (
                      <small>{r.competitionName}</small>
                    )}
                  </span>
                  <ExternalLink size={11} />
                </a>
              </td>
              <td>{roundTypeLabels[r.roundTypeId] || r.roundTypeId}</td>
              <td className="pos-cell">{r.pos}</td>
              <td className="result-cell">{formatWcaResult(eventId, r.best, "single")}</td>
              <td className="result-cell">
                {r.average > 0 ? formatWcaResult(eventId, r.average, "average") : "-"}
              </td>
              <td className="detail-cell">{detailValues.join("  ")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CompetitionResultsTable({ results, allEventIds }: { results: CompetitionResult[]; allEventIds: string[] }) {
  const byCompetition = new Map<string, CompetitionResult[]>();
  for (const r of results) {
    const list = byCompetition.get(r.competitionId) || [];
    list.push(r);
    byCompetition.set(r.competitionId, list);
  }

  const sortedComps = [...byCompetition.entries()].sort((a, b) => b[1][0].date.localeCompare(a[1][0].date));

  if (sortedComps.length === 0) return <p className="no-results">暂无成绩记录</p>;

  return (
    <div className="competition-results-list">
      {sortedComps.map(([compId, compResults]) => (
        <details key={compId} className="comp-details" open>
          <summary>
            <span className="comp-summary-name">
              <strong>{getCompetitionDisplayName(compResults[0])}</strong>
              {compResults[0].competitionNameZh && compResults[0].competitionNameZh !== compResults[0].competitionName && (
                <small>{compResults[0].competitionName}</small>
              )}
            </span>
            <span className="comp-date">{compResults[0].date}</span>
          </summary>
          <table className="result-table person-results-table">
            <thead>
              <tr>
                <th>项目</th>
                <th>轮次</th>
                <th>名次</th>
                <th>单次</th>
                <th>平均</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {compResults.map((r, i) => {
                const detailValues = [r.value1, r.value2, r.value3, r.value4, r.value5]
                  .filter((v) => v > 0)
                  .map((v) => formatWcaAttempt(r.eventId, v));
                return (
                  <tr key={i}>
                    <td>{getEventName(r.eventId)}</td>
                    <td>{roundTypeLabels[r.roundTypeId] || r.roundTypeId}</td>
                    <td className="pos-cell">{r.pos}</td>
                    <td className="result-cell">{formatWcaResult(r.eventId, r.best, "single")}</td>
                    <td className="result-cell">
                      {r.average > 0 ? formatWcaResult(r.eventId, r.average, "average") : "-"}
                    </td>
                    <td className="detail-cell">{detailValues.join("  ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      ))}
    </div>
  );
}
