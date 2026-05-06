"use client";

import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Database, ExternalLink, Globe2 } from "lucide-react";
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
  const [lastExportDate, setLastExportDate] = useState("");
  const [event, setEvent] = useState("333");
  const [country, setCountry] = useState("China");
  const [mode, setMode] = useState<RankingMode>("average");
  const [gender, setGender] = useState<Gender>("all");
  const [page, setPage] = useState(1);
  const [rankings, setRankings] = useState<RankingsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wca-metadata", { cache: "no-cache" })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        setEvents(payload.events || []);
        setCountries(payload.countries || []);
        setLastExportDate(payload.lastExportDate || "");
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
          setError("无法读取排名数据，请确认 WCA 数据库已同步。");
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
  const updateDateLabel = formatWcaExportDate(lastExportDate);

  function updateFilter(next: Partial<{ event: string; country: string; mode: RankingMode; gender: Gender }>) {
    if (next.event) setEvent(next.event);
    if (next.country) setCountry(next.country);
    if (next.mode) setMode(next.mode);
    if (next.gender) setGender(next.gender);
    setPage(1);
  }

  return (
    <>
      <PageHero className="ranking-page-hero" label="WCA 官方数据本地库" title={`${countryName} ${eventName}排名`}>
        WCA 官方口径，本地 PostgreSQL 查询。
      </PageHero>

      <section className="container section rankings-workspace">
        <section className="weekly-event-section ranking-filter-section">
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
                {countryName} · {modeLabels[mode]} · {genderLabels[gender]} · 第 {page} 页
              </span>
              <h2>{eventName}排名 <small>{firstRank}-{lastRank}</small></h2>
            </div>
            <div className="ranking-source-line">
              <Database size={16} />
              <span>PostgreSQL API</span>
              <Globe2 size={16} />
              <span>WCA ID 关联</span>
              {updateDateLabel ? (
                <>
                  <CalendarClock size={16} />
                  <span>数据更新 {updateDateLabel}</span>
                </>
              ) : null}
            </div>
          </div>

          {error ? <div className="wca-state">{error}</div> : null}

          <div className="result-table-wrap">
            <table className="result-table ranking-table wca-ranking-results-table">
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

function formatWcaExportDate(value: string) {
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
