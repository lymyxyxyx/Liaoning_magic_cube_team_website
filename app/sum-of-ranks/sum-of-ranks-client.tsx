"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Database } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { WcaFlag } from "@/components/wca-flag";
import { formatCountryLabel } from "@/lib/country-label";
import { formatWcaEventName } from "@/lib/format";

type RankingMode = "single" | "average";
type Region = "world" | "asia" | "china" | "liaoning";

type SumEvent = {
  id: string;
  name: string;
};

type SumRow = {
  rank: number;
  wcaId: string;
  name: string;
  country: string;
  countryName: string;
  countryIso2?: string | null;
  sum: number;
  ranksByEvent: Record<string, number>;
  missingByEvent: Record<string, boolean>;
};

type SumResponse = {
  rows: SumRow[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  events: SumEvent[];
  regionLabel: string;
};

const modeLabels: Record<RankingMode, string> = {
  single: "单次",
  average: "平均"
};

const regionLabels: Record<Region, string> = {
  world: "世界",
  asia: "亚洲",
  china: "中国",
  liaoning: "辽宁"
};

export function SumOfRanksClient() {
  const [mode, setMode] = useState<RankingMode>("average");
  const [region, setRegion] = useState<Region>("china");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SumResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      type: mode,
      region,
      page: String(page)
    });

    setIsLoading(true);
    setError("");
    fetch(`/api/sum-of-ranks?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("sum-of-ranks");
        return response.json();
      })
      .then((payload: SumResponse) => {
        setData(payload);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setError("无法读取排名总和数据，请确认 WCA 数据库已同步。");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [mode, region, page]);

  const rows = data?.rows || [];
  const events = data?.events || [];
  const tableTitle = useMemo(() => `${regionLabels[region]} · ${modeLabels[mode]} · 第 ${page} 页`, [mode, page, region]);

  function updateFilter(next: Partial<{ mode: RankingMode; region: Region }>) {
    if (next.mode) setMode(next.mode);
    if (next.region) setRegion(next.region);
    setPage(1);
  }

  return (
    <section className="container section rankings-workspace sum-ranks-workspace">
      <section className="weekly-event-section ranking-filter-section">
        <div className="section-header">
          <div>
            <span className="eyebrow">筛选条件</span>
            <h2>排名总和查询</h2>
          </div>
        </div>

        <div className="ranking-filter-card sum-ranks-filter-card" aria-label="排名总和筛选">
          <div className="ranking-field">
            <span>范围</span>
            <div className="ranking-toggle">
              {(["world", "asia", "china", "liaoning"] as Region[]).map((item) => (
                <button className={region === item ? "active" : ""} type="button" onClick={() => updateFilter({ region: item })} key={item}>
                  {regionLabels[item]}
                </button>
              ))}
            </div>
          </div>

          <div className="ranking-field">
            <span>还原类型</span>
            <div className="ranking-toggle">
              {(["single", "average"] as RankingMode[]).map((item) => (
                <button className={mode === item ? "active" : ""} type="button" onClick={() => updateFilter({ mode: item })} key={item}>
                  {modeLabels[item]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="weekly-event-section ranking-results-section">
        <div className="section-header">
          <div>
            <span className="eyebrow">Sum of Ranks</span>
            <h2>
              {tableTitle}
              <small>缺项按该范围内项目最差排名后一位计入</small>
            </h2>
          </div>
          <div className="ranking-update">
            <Database size={16} />
            WCA 本地库
          </div>
        </div>

        {error ? <div className="alert error">{error}</div> : null}

        <div className="competition-table-wrap sum-ranks-table-wrap">
          <table className="competition-list-table sum-ranks-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>姓名</th>
                <th>地区</th>
                <th>总和</th>
                {events.map((event) => (
                  <th title={formatWcaEventName(event.id, event.name)} key={event.id}>
                    {event.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={events.length + 4}>正在读取排名总和数据...</td>
                </tr>
              ) : null}
              {!isLoading && rows.length === 0 ? (
                <tr>
                  <td colSpan={events.length + 4}>当前范围暂无数据。</td>
                </tr>
              ) : null}
              {!isLoading
                ? rows.map((row) => (
                    <tr key={`${mode}-${region}-${row.wcaId}`}>
                      <td data-label="排名">{row.rank}</td>
                      <td data-label="姓名">
                        <Link className="table-person-link" href={`https://www.worldcubeassociation.org/persons/${row.wcaId}`} target="_blank">
                          {row.name}
                        </Link>
                        <small className="ranking-wca-id">{row.wcaId}</small>
                      </td>
                      <td data-label="地区">
                        <span className="flag-label">
                          <WcaFlag country={row.country} iso2={row.countryIso2} />
                          {formatCountryLabel(row.countryName, row.countryIso2)}
                        </span>
                      </td>
                      <td data-label="总和" className="score-strong">
                        {row.sum}
                      </td>
                      {events.map((event) => {
                        const rank = row.ranksByEvent[event.id];
                        const missing = row.missingByEvent[event.id];
                        return (
                          <td className={missing ? "sum-rank-missing" : rank <= 10 ? "sum-rank-top" : undefined} data-label={event.id} key={event.id}>
                            {rank || "-"}
                          </td>
                        );
                      })}
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
          <button type="button" onClick={() => setPage((value) => value + 1)} disabled={!data?.hasNextPage}>
            下一页
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
    </section>
  );
}
