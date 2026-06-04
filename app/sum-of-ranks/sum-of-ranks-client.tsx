"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Database } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { WcaFlag } from "@/components/wca-flag";
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

const mockEvents: SumEvent[] = [
  { id: "333", name: "3x3x3 Cube" },
  { id: "222", name: "2x2x2 Cube" },
  { id: "444", name: "4x4x4 Cube" },
  { id: "555", name: "5x5x5 Cube" },
  { id: "666", name: "6x6x6 Cube" },
  { id: "777", name: "7x7x7 Cube" },
  { id: "333oh", name: "3x3x3 One-Handed" },
  { id: "333bf", name: "3x3x3 Blindfolded" },
  { id: "clock", name: "Clock" },
  { id: "minx", name: "Megaminx" },
  { id: "pyram", name: "Pyraminx" },
  { id: "skewb", name: "Skewb" },
  { id: "sq1", name: "Square-1" }
];

const mockRows: SumRow[] = [
  {
    rank: 1,
    wcaId: "2024LIZH03",
    name: "Zhaokun Li（李昭昆）",
    country: "China",
    countryName: "China",
    countryIso2: "CN",
    sum: 86,
    ranksByEvent: { "333": 1, "222": 4, "444": 2, "555": 3, "666": 5, "777": 6, "333oh": 2, "333bf": 9, clock: 18, minx: 7, pyram: 11, skewb: 12, sq1: 8 },
    missingByEvent: {}
  },
  {
    rank: 2,
    wcaId: "2023LIAO01",
    name: "Minghao Chen（陈明昊）",
    country: "China",
    countryName: "China",
    countryIso2: "CN",
    sum: 112,
    ranksByEvent: { "333": 2, "222": 6, "444": 5, "555": 9, "666": 14, "777": 16, "333oh": 4, "333bf": 21, clock: 10, minx: 12, pyram: 7, skewb: 5, sq1: 8 },
    missingByEvent: {}
  },
  {
    rank: 3,
    wcaId: "2022DALI01",
    name: "Yue Zhao（赵悦）",
    country: "China",
    countryName: "China",
    countryIso2: "CN",
    sum: 145,
    ranksByEvent: { "333": 4, "222": 3, "444": 8, "555": 18, "666": 22, "777": 24, "333oh": 6, "333bf": 26, clock: 14, minx: 9, pyram: 18, skewb: 11, sq1: 19 },
    missingByEvent: {}
  },
  {
    rank: 4,
    wcaId: "2021ANSH01",
    name: "Haoran Lin（林浩然）",
    country: "China",
    countryName: "China",
    countryIso2: "CN",
    sum: 172,
    ranksByEvent: { "333": 6, "222": 9, "444": 6, "555": 11, "666": 19, "777": 31, "333oh": 8, "333bf": 33, clock: 17, minx: 16, pyram: 15, skewb: 14, sq1: 20 },
    missingByEvent: { "333bf": true }
  },
  {
    rank: 5,
    wcaId: "2025FUSH01",
    name: "Jinyi Sun（孙锦一）",
    country: "China",
    countryName: "China",
    countryIso2: "CN",
    sum: 201,
    ranksByEvent: { "333": 8, "222": 12, "444": 13, "555": 17, "666": 28, "777": 35, "333oh": 9, "333bf": 33, clock: 21, minx: 20, pyram: 16, skewb: 18, sq1: 24 },
    missingByEvent: { "333bf": true }
  }
];

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
          if (process.env.NODE_ENV === "development") {
            setData({
              rows: [],
              page,
              pageSize: 100,
              hasNextPage: false,
              events: mockEvents,
              regionLabel: regionLabels[region]
            });
          } else {
            setError("无法读取排名总和数据，请确认 WCA 数据库已同步。");
          }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [mode, region, page]);

  const shouldUseMockRows = process.env.NODE_ENV === "development" && !isLoading && (!data?.rows || data.rows.length === 0);
  const rows = shouldUseMockRows ? mockRows : data?.rows || [];
  const events = shouldUseMockRows ? mockEvents : data?.events || [];
  const tableTitle = useMemo(() => `${regionLabels[region]}综合排名`, [region]);

  function updateFilter(next: Partial<{ mode: RankingMode; region: Region }>) {
    if (next.mode) setMode(next.mode);
    if (next.region) setRegion(next.region);
    setPage(1);
  }

  return (
    <section className="container section rankings-workspace sum-ranks-workspace">
      <section className="weekly-event-section ranking-filter-section">
        <div className="ranking-filter-card sum-ranks-filter-card" aria-label="排名总和筛选">
          <div className="ranking-field">
            <span>范围</span>
            <div className="ranking-toggle sum-ranks-region-toggle">
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
              <small>{modeLabels[mode]} · 第 {page} 页</small>
            </h2>
          </div>
          <div className="ranking-update">
            <Database size={16} />
            WCA 本地库
          </div>
        </div>

        {error && !shouldUseMockRows ? <div className="alert error">{error}</div> : null}

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
                        <Link
                          className="table-person-link"
                          href={`https://cubing.com/results/person/${row.wcaId}`}
                          referrerPolicy="no-referrer"
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td data-label="地区">
                        <span className="flag-label">
                          <WcaFlag country={row.country} iso2={row.countryIso2} />
                          <span className="sum-ranks-country-name">{row.countryName || row.country}</span>
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
