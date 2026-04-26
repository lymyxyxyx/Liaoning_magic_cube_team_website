"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Database, ExternalLink, Globe2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHero } from "@/components/page-hero";

type RankingMode = "single" | "average";
type Gender = "all" | "m" | "f";

type MetadataOption = {
  id: string;
  name: string;
};

type RankingRow = {
  rank: number;
  worldRank: number;
  wcaId: string;
  name: string;
  country: string;
  countryName: string;
  gender: string;
  result: string;
  competitionId: string;
  competitionName: string;
  date: string;
};

type RankingsResponse = {
  rows: RankingRow[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
};

const modeLabels: Record<RankingMode, string> = {
  single: "单次",
  average: "平均"
};

const genderLabels: Record<Gender, string> = {
  all: "所有",
  m: "男",
  f: "女"
};

function WcaFlag({ country }: { country: string }) {
  return <span className={`wca-flag flag-${country.toLowerCase().replaceAll(" ", "-")}`} aria-hidden="true" />;
}

export function RankingsClient() {
  const [events, setEvents] = useState<MetadataOption[]>([]);
  const [countries, setCountries] = useState<MetadataOption[]>([]);
  const [event, setEvent] = useState("333");
  const [country, setCountry] = useState("China");
  const [mode, setMode] = useState<RankingMode>("single");
  const [gender, setGender] = useState<Gender>("all");
  const [page, setPage] = useState(1);
  const [rankings, setRankings] = useState<RankingsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wca-metadata")
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        setEvents(payload.events || []);
        setCountries(payload.countries || []);
      })
      .catch(() => {
        if (!cancelled) setError("无法读取 WCA 项目和国家列表。");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      event,
      country,
      mode,
      gender,
      page: String(page)
    });

    setIsLoading(true);
    setError("");
    fetch(`/api/wca-rankings?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("rankings");
        return response.json();
      })
      .then((payload: RankingsResponse) => {
        setRankings(payload);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setError("无法读取排名数据，请确认本地 SQLite 已生成。");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [event, country, mode, gender, page]);

  const eventName = useMemo(() => events.find((item) => item.id === event)?.name || event, [events, event]);
  const countryName = useMemo(
    () => countries.find((item) => item.id === country)?.name || country,
    [countries, country]
  );
  const rows = rankings?.rows || [];
  const firstRank = rows[0]?.rank || (page - 1) * 100 + 1;
  const lastRank = rows.length ? rows[rows.length - 1].rank : page * 100;

  function updateFilter(next: Partial<{ event: string; country: string; mode: RankingMode; gender: Gender }>) {
    if (next.event) setEvent(next.event);
    if (next.country) setCountry(next.country);
    if (next.mode) setMode(next.mode);
    if (next.gender) setGender(next.gender);
    setPage(1);
  }

  return (
    <>
      <PageHero label="WCA 官方数据本地库" title={`${countryName} ${eventName}排名`}>
        数据保留 WCA 官方口径，筛选和分页由本地 SQLite API 提供；辽宁省标签后续会在独立页面维护。
      </PageHero>

      <section className="container section">
        <div className="weekly-intro">
          <p>
            当前展示 {countryName} · {eventName} · {modeLabels[mode]} · {genderLabels[gender]}，每页 100 名。
          </p>
          <strong>官方排名与本地标签分离：这里不混入省份字段，辽宁榜单会单独关联 WCA ID。</strong>
        </div>

        <div className="weekly-summary-grid">
          <div className="stat">
            <strong>{eventName}</strong>
            <span>当前项目</span>
          </div>
          <div className="stat">
            <strong>{countryName}</strong>
            <span>国家/地区</span>
          </div>
          <div className="stat">
            <strong>{modeLabels[mode]}</strong>
            <span>还原类型</span>
          </div>
          <div className="stat">
            <strong>{firstRank}-{lastRank}</strong>
            <span>当前排名段</span>
          </div>
        </div>

        <section className="weekly-event-section">
          <div className="section-header">
            <div>
              <span className="eyebrow">筛选条件</span>
              <h2>排名查询</h2>
            </div>
          </div>
          <div className="ranking-filter-card" aria-label="排名筛选">
            <label className="ranking-field">
              <span>项目</span>
              <select value={event} onChange={(changeEvent) => updateFilter({ event: changeEvent.target.value })}>
                {events.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="ranking-field">
              <span>地区</span>
              <select value={country} onChange={(changeEvent) => updateFilter({ country: changeEvent.target.value })}>
                {countries.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="ranking-field">
              <span>还原类型</span>
              <div className="ranking-toggle">
                {(["single", "average"] as RankingMode[]).map((item) => (
                  <button
                    className={mode === item ? "active" : ""}
                    type="button"
                    onClick={() => updateFilter({ mode: item })}
                    key={item}
                  >
                    {modeLabels[item]}
                  </button>
                ))}
              </div>
            </div>

            <div className="ranking-field">
              <span>性别</span>
              <div className="ranking-toggle">
                {(["all", "m", "f"] as Gender[]).map((item) => (
                  <button
                    className={gender === item ? "active" : ""}
                    type="button"
                    onClick={() => updateFilter({ gender: item })}
                    key={item}
                  >
                    {genderLabels[item]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="weekly-event-section ranking-results-section">
          <div className="section-header">
            <div>
              <span className="eyebrow">
                {modeLabels[mode]} · 第 {page} 页
              </span>
              <h2>{eventName}排名</h2>
            </div>
            <div className="ranking-source-line">
              <Database size={16} />
              <span>SQLite API</span>
              <Globe2 size={16} />
              <span>WCA ID 关联</span>
            </div>
          </div>

          {error ? <div className="wca-state">{error}</div> : null}

          <div className="result-table-wrap">
            <table className="result-table ranking-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>姓名</th>
                  <th>性别</th>
                  <th>成绩</th>
                  <th>地区</th>
                  <th>WR</th>
                  <th>比赛</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7}>加载中...</td>
                  </tr>
                ) : null}
                {!isLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>当前筛选没有排名数据。</td>
                  </tr>
                ) : null}
                {!isLoading
                  ? rows.map((row) => (
                      <tr key={`${mode}-${event}-${row.wcaId}`}>
                        <td>{row.rank}</td>
                        <td>
                          <Link
                            className="table-person-link"
                            href={`https://www.worldcubeassociation.org/persons/${row.wcaId}`}
                          >
                            {row.name}
                          </Link>
                          <small className="ranking-wca-id">{row.wcaId}</small>
                        </td>
                        <td>{row.gender === "m" ? "男" : row.gender === "f" ? "女" : "-"}</td>
                        <td className="score-strong">{row.result}</td>
                        <td>
                          <span className="flag-label">
                            <WcaFlag country={row.country} />
                            {row.countryName}
                          </span>
                        </td>
                        <td>{row.worldRank}</td>
                        <td>
                          {row.competitionId ? (
                            <Link
                              className="table-person-link ranking-competition-link"
                              href={`https://www.worldcubeassociation.org/competitions/${row.competitionId}`}
                            >
                              <span>{row.competitionName}</span>
                              <ExternalLink size={14} />
                            </Link>
                          ) : (
                            <span className="muted-cell">未匹配比赛</span>
                          )}
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>

          <div className="wca-pagination">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
              <ChevronLeft size={18} />
              上一页
            </button>
            <span>第 {page} 页</span>
            <button type="button" onClick={() => setPage((value) => value + 1)} disabled={!rankings?.hasNextPage}>
              下一页
              <ChevronRight size={18} />
            </button>
          </div>
        </section>
      </section>
    </>
  );
}
