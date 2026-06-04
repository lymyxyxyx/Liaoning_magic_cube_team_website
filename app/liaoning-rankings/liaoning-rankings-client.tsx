"use client";

import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHero } from "@/components/page-hero";
import { WcaFlag } from "@/components/wca-flag";
import { getCubingCompetitionNameZhByWcaId } from "@/lib/cubing-competition-name";
import { formatWcaExportDate, formatRankCell, formatWcaEventName } from "@/lib/format";

type RankingMode = "single" | "average";
type Gender = "all" | "m" | "f";
type Scope = "province" | "city";

type MetadataOption = {
  id: string;
  name: string;
};

type LocalRankingRow = {
  rank: number;
  rankChange: number | null;
  officialRank: number;
  officialRankChange: number | null;
  worldRank: number;
  worldRankChange: number | null;
  genderLocalRank: number | null;
  genderOfficialRank: number | null;
  genderWorldRank: number | null;
  wcaId: string;
  name: string;
  country: string;
  countryName: string;
  countryIso2?: string | null;
  gender: string;
  result: string;
  resultDetails: string[];
  competitionId: string;
  competitionName: string;
  date: string;
  province: string;
  city: string;
};

type LocalRankingsResponse = {
  rows: LocalRankingRow[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  provinces: string[];
  cities: string[];
};

const modeLabels: Record<RankingMode, string> = {
  single: "单次",
  average: "平均"
};

const genderLabels: Record<Gender, string> = {
  all: "不限",
  m: "男",
  f: "女"
};

const scopeLabels: Record<Scope, string> = {
  province: "省排名",
  city: "市排名"
};

const isDevelopmentPreview = process.env.NODE_ENV === "development";

const developmentEvents: MetadataOption[] = [{ id: "333", name: "3x3x3 Cube" }];

const mockLocalRankingRows: LocalRankingRow[] = [
  {
    rank: 1,
    rankChange: null,
    officialRank: 6,
    officialRankChange: null,
    worldRank: 6,
    worldRankChange: null,
    genderLocalRank: 1,
    genderOfficialRank: 6,
    genderWorldRank: 6,
    wcaId: "2024LIZH03",
    name: "Zhaokun Li（李昭昆）",
    country: "China",
    countryName: "China",
    countryIso2: "CN",
    gender: "m",
    result: "4.59",
    resultDetails: ["4.22", "4.57", "4.60", "4.61", "4.89"],
    competitionId: "LiaoningOpen2026",
    competitionName: "Liaoning Open 2026",
    date: "2026-01-05",
    province: "辽宁",
    city: "沈阳"
  },
  {
    rank: 2,
    rankChange: null,
    officialRank: 18,
    officialRankChange: null,
    worldRank: 34,
    worldRankChange: null,
    genderLocalRank: 2,
    genderOfficialRank: 16,
    genderWorldRank: 31,
    wcaId: "2023LIAO01",
    name: "Minghao Chen（陈明昊）",
    country: "China",
    countryName: "China",
    countryIso2: "CN",
    gender: "m",
    result: "5.18",
    resultDetails: ["4.93", "5.10", "5.20", "5.24", "5.41"],
    competitionId: "ShenyangCubingLeague2026",
    competitionName: "Shenyang Cubing League 2026",
    date: "2026-04-12",
    province: "辽宁",
    city: "沈阳"
  },
  {
    rank: 3,
    rankChange: null,
    officialRank: 29,
    officialRankChange: null,
    worldRank: 58,
    worldRankChange: null,
    genderLocalRank: 1,
    genderOfficialRank: 4,
    genderWorldRank: 11,
    wcaId: "2022DALI01",
    name: "Yue Zhao（赵悦）",
    country: "China",
    countryName: "China",
    countryIso2: "CN",
    gender: "f",
    result: "5.63",
    resultDetails: ["5.31", "5.55", "5.61", "5.73", "5.95"],
    competitionId: "DalianSummer2026",
    competitionName: "Dalian Summer 2026",
    date: "2026-03-23",
    province: "辽宁",
    city: "大连"
  },
  {
    rank: 4,
    rankChange: null,
    officialRank: 42,
    officialRankChange: null,
    worldRank: 89,
    worldRankChange: null,
    genderLocalRank: 3,
    genderOfficialRank: 37,
    genderWorldRank: 78,
    wcaId: "2021ANSH01",
    name: "Haoran Lin（林浩然）",
    country: "China",
    countryName: "China",
    countryIso2: "CN",
    gender: "m",
    result: "6.02",
    resultDetails: ["5.70", "5.96", "6.03", "6.08", "6.20"],
    competitionId: "AnshanOpen2026",
    competitionName: "Anshan Open 2026",
    date: "2026-02-11",
    province: "辽宁",
    city: "鞍山"
  },
  {
    rank: 5,
    rankChange: null,
    officialRank: 57,
    officialRankChange: null,
    worldRank: 122,
    worldRankChange: null,
    genderLocalRank: 4,
    genderOfficialRank: 51,
    genderWorldRank: 109,
    wcaId: "2025FUSH01",
    name: "Jinyi Sun（孙锦一）",
    country: "China",
    countryName: "China",
    countryIso2: "CN",
    gender: "m",
    result: "6.48",
    resultDetails: ["6.20", "6.39", "6.46", "6.58", "6.81"],
    competitionId: "FushunSpring2026",
    competitionName: "Fushun Spring 2026",
    date: "2026-02-02",
    province: "辽宁",
    city: "抚顺"
  }
];

export function LiaoningRankingsClient() {
  const [events, setEvents] = useState<MetadataOption[]>([]);
  const [lastExportDate, setLastExportDate] = useState("");
  const [event, setEvent] = useState("333");
  const [province, setProvince] = useState("辽宁");
  const [city, setCity] = useState("沈阳");
  const [scope, setScope] = useState<Scope>("province");
  const [mode, setMode] = useState<RankingMode>("average");
  const [gender, setGender] = useState<Gender>("all");
  const [page, setPage] = useState(1);
  const [rankings, setRankings] = useState<LocalRankingsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wca-metadata", { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("metadata");
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        setEvents(payload.events || []);
        setLastExportDate(payload.lastExportDate || "");
      })
      .catch(() => {
        if (cancelled) return;
        if (isDevelopmentPreview) {
          setEvents(developmentEvents);
          setLastExportDate("2026-06-03");
          return;
        }
        setError("无法读取 WCA 项目列表。");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let didUseDevelopmentFallback = false;
    const params = new URLSearchParams({
      event,
      province,
      city,
      scope,
      mode,
      gender,
      page: String(page)
    });

    setIsLoading(true);
    setError("");
    const useDevelopmentFallback = () => {
      if (!isDevelopmentPreview || didUseDevelopmentFallback) return;
      didUseDevelopmentFallback = true;
      setRankings({
        rows: [],
        page,
        pageSize: 100,
        hasNextPage: false,
        provinces: ["辽宁"],
        cities: ["沈阳", "大连", "鞍山", "抚顺"]
      });
      setError("");
      setIsLoading(false);
    };
    const developmentFallbackTimer = isDevelopmentPreview ? window.setTimeout(useDevelopmentFallback, 1200) : undefined;

    fetch(`/api/local-rankings?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("rankings");
        return response.json();
      })
      .then((payload: LocalRankingsResponse) => {
        if (developmentFallbackTimer) window.clearTimeout(developmentFallbackTimer);
        setRankings(payload);
      })
      .catch((requestError) => {
        if (developmentFallbackTimer) window.clearTimeout(developmentFallbackTimer);
        if (requestError.name !== "AbortError") {
          if (isDevelopmentPreview) {
            useDevelopmentFallback();
            return;
          }
          setError("无法读取辽宁排名数据，请确认 WCA 数据库已同步。");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && !didUseDevelopmentFallback) setIsLoading(false);
      });

    return () => {
      if (developmentFallbackTimer) window.clearTimeout(developmentFallbackTimer);
      controller.abort();
    };
  }, [event, province, city, scope, mode, gender, page]);

  const eventName = useMemo(() => {
    const found = events.find((item) => item.id === event);
    return found ? formatWcaEventName(found.id, found.name) : event;
  }, [events, event]);
  const isUsingMockRows = isDevelopmentPreview && !isLoading && (!rankings || rankings.rows.length === 0);
  const rows = isUsingMockRows
    ? mockLocalRankingRows
        .filter((row) => scope === "province" || row.city === city)
        .map((row, index) => ({ ...row, rank: index + 1, genderLocalRank: index + 1 }))
    : rankings?.rows || [];
  const provinces = rankings?.provinces?.length ? rankings.provinces : ["辽宁"];
  const cities = rankings?.cities?.length ? rankings.cities : ["沈阳"];
  const areaLabel = scope === "province" ? `${province}省` : `${city}市`;
  const updateDateLabel = formatWcaExportDate(lastExportDate) || (isUsingMockRows ? "2026/06/03" : "");
  const showGenderRankColumns = gender !== "all";
  const showAverageDetailsColumn = mode === "average";
  const genderRankLabel = gender === "m" ? "男子" : "女子";
  const baseColumnCount = showGenderRankColumns ? 11 : 8;
  const totalColumnCount = baseColumnCount + (showAverageDetailsColumn ? 1 : 0);
  const visibleError = isUsingMockRows ? "" : error;

  function updateFilter(next: Partial<{ event: string; province: string; city: string; scope: Scope; mode: RankingMode; gender: Gender }>) {
    if (next.event) setEvent(next.event);
    if (next.province) setProvince(next.province);
    if (next.city) setCity(next.city);
    if (next.scope) setScope(next.scope);
    if (next.mode) setMode(next.mode);
    if (next.gender) setGender(next.gender);
    setPage(1);
  }

  return (
    <>
      <PageHero className="ranking-page-hero local-ranking-page-hero" label="本地省市归属" title={`${areaLabel} ${eventName}排名`}>
        {scopeLabels[scope]} · {modeLabels[mode]} · {genderLabels[gender]}性别
      </PageHero>

      <section className="container section local-rankings-section rankings-workspace">
        <section className="weekly-event-section ranking-filter-section">
          <div className="ranking-filter-card local-ranking-filter-card" aria-label="辽宁排名筛选">
            <div className="ranking-field">
              <span>榜单类型</span>
              <div className="ranking-toggle">
                {(["province", "city"] as Scope[]).map((item) => (
                  <button
                    className={scope === item ? "active" : ""}
                    type="button"
                    onClick={() => updateFilter({ scope: item })}
                    key={item}
                  >
                    {scopeLabels[item]}
                  </button>
                ))}
              </div>
            </div>

            <label className="ranking-field">
              <span>省份</span>
              <select value={province} onChange={(changeEvent) => updateFilter({ province: changeEvent.target.value })}>
                {provinces.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            {scope === "city" ? (
              <label className="ranking-field">
                <span>城市</span>
                <select value={city} onChange={(changeEvent) => updateFilter({ city: changeEvent.target.value })}>
                  {cities.map((item) => (
                    <option value={item} key={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="ranking-field">
              <span>项目</span>
              <select value={event} onChange={(changeEvent) => updateFilter({ event: changeEvent.target.value })}>
                {events.map((item) => (
                  <option value={item.id} key={item.id}>
                    {formatWcaEventName(item.id, item.name)}
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
              <h2>{eventName}{scopeLabels[scope]} <small>本页 {rows.length} 人</small></h2>
            </div>
            <div className="ranking-source-line">
              {updateDateLabel ? (
                <>
                  <CalendarClock size={14} />
                  <span className="ranking-source-label">数据更新</span>
                  <span>{updateDateLabel}</span>
                </>
              ) : null}
            </div>
          </div>

          {visibleError ? <div className="wca-state">{visibleError}</div> : null}

          <div className="result-table-wrap">
            <table className={`result-table ranking-table local-ranking-results-table ${showGenderRankColumns ? "has-gender-ranks" : ""}`}>
              <thead>
                <tr>
                  <th>{scopeLabels[scope]}</th>
                  <th>姓名</th>
                  <th>性别</th>
                  <th>成绩</th>
                  <th>省市</th>
                  <th>全国排名</th>
                  <th>世界排名</th>
                  {showGenderRankColumns ? (
                    <>
                      <th>{genderRankLabel}{scopeLabels[scope]}</th>
                      <th>{genderRankLabel}全国排名</th>
                      <th>{genderRankLabel}世界排名</th>
                    </>
                  ) : null}
                  <th>比赛</th>
                  {showAverageDetailsColumn ? <th>平均明细</th> : null}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={totalColumnCount}>加载中...</td>
                  </tr>
                ) : null}
                {!isLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={totalColumnCount}>当前筛选没有辽宁本地排名数据。</td>
                  </tr>
                ) : null}
                {!isLoading
                  ? rows.map((row) => (
                      <tr key={`${scope}-${mode}-${event}-${row.wcaId}`}>
                        <td data-label={scopeLabels[scope]}>{row.rank}</td>
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
                        <td data-label="性别">{row.gender === "m" ? "男" : row.gender === "f" ? "女" : "-"}</td>
                        <td data-label="成绩" className="score-strong">
                          {row.result}
                        </td>
                        <td data-label="省市">{row.province} · {row.city}</td>
                        <td data-label="全国排名">{row.officialRank}</td>
                        <td data-label="世界排名">{row.worldRank}</td>
                        {showGenderRankColumns ? (
                          <>
                            <td data-label={`${genderRankLabel}${scopeLabels[scope]}`}>{formatRankCell(row.genderLocalRank)}</td>
                            <td data-label={`${genderRankLabel}全国排名`}>{formatRankCell(row.genderOfficialRank)}</td>
                            <td data-label={`${genderRankLabel}世界排名`}>{formatRankCell(row.genderWorldRank)}</td>
                          </>
                        ) : null}
                        <td data-label="比赛">
                          {row.competitionId ? (
                            <Link
                              className="table-person-link ranking-competition-link"
                              href={`https://www.worldcubeassociation.org/competitions/${row.competitionId}`}
                            >
                              <WcaFlag country={row.country} iso2={row.countryIso2} />
                              <span>
                                {getCubingCompetitionNameZhByWcaId(row.competitionId, row.competitionName) ||
                                  row.competitionName}
                              </span>
                              <ExternalLink size={14} />
                            </Link>
                          ) : (
                            <span className="muted-cell">未匹配比赛</span>
                          )}
                        </td>
                        {showAverageDetailsColumn ? (
                          <td data-label="平均明细">
                            {row.resultDetails?.length ? (
                              <small className="ranking-result-details">{row.resultDetails.join(" / ")}</small>
                            ) : (
                              <span className="muted-cell">-</span>
                            )}
                          </td>
                        ) : null}
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
