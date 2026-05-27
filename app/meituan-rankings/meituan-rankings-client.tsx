"use client";

import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Database, ExternalLink, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHero } from "@/components/page-hero";
import { WcaFlag } from "@/components/wca-flag";
import { formatWcaExportDate, formatRankCell } from "@/lib/format";

type RankingMode = "single" | "average";
type Gender = "all" | "m" | "f";
type MemberScope = "all" | "current";

type MetadataOption = {
  id: string;
  name: string;
};

type MeituanRankingRow = {
  rank: number;
  officialRank: number;
  worldRank: number;
  genderGroupRank: number | null;
  genderOfficialRank: number | null;
  genderWorldRank: number | null;
  wcaId: string;
  name: string;
  memberStatus: "current" | "former";
  country: string;
  countryName: string;
  gender: string;
  result: string;
  resultDetails: string[];
  competitionId: string;
  competitionName: string;
  date: string;
};

type MeituanRankingsResponse = {
  rows: MeituanRankingRow[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  memberCount: number;
  dbUnavailable?: boolean;
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

const memberScopeLabels: Record<MemberScope, string> = {
  all: "全体",
  current: "仅在职"
};

const fallbackEvents: MetadataOption[] = [{ id: "333", name: "三阶魔方" }];

export function MeituanRankingsClient() {
  const [events, setEvents] = useState<MetadataOption[]>([]);
  const [lastExportDate, setLastExportDate] = useState("");
  const [event, setEvent] = useState("333");
  const [mode, setMode] = useState<RankingMode>("average");
  const [gender, setGender] = useState<Gender>("all");
  const [memberScope, setMemberScope] = useState<MemberScope>("all");
  const [page, setPage] = useState(1);
  const [rankings, setRankings] = useState<MeituanRankingsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wca-metadata", { cache: "no-cache" })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        setEvents(payload.events || []);
        setLastExportDate(payload.lastExportDate || "");
      })
      .catch(() => {
        if (!cancelled) setEvents(fallbackEvents);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      event,
      mode,
      gender,
      memberScope,
      page: String(page)
    });

    setIsLoading(true);
    setError("");
    fetch(`/api/meituan-rankings?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("rankings");
        return response.json();
      })
      .then((payload: MeituanRankingsResponse) => {
        setRankings(payload);
        if (payload.dbUnavailable) setError("无法读取美团排名数据，请确认 WCA 数据库已同步。");
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setError("无法读取美团排名数据，请确认 WCA 数据库已同步。");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [event, mode, gender, memberScope, page]);

  const eventOptions = events.length ? events : fallbackEvents;
  const eventName = useMemo(() => eventOptions.find((item) => item.id === event)?.name || event, [eventOptions, event]);
  const rows = rankings?.rows || [];
  const updateDateLabel = formatWcaExportDate(lastExportDate);
  const showGenderRankColumns = gender !== "all";
  const genderRankLabel = gender === "m" ? "男子" : "女子";

  function updateFilter(next: Partial<{ event: string; mode: RankingMode; gender: Gender; memberScope: MemberScope }>) {
    if (next.event) setEvent(next.event);
    if (next.mode) setMode(next.mode);
    if (next.gender) setGender(next.gender);
    if (next.memberScope) setMemberScope(next.memberScope);
    setPage(1);
  }

  return (
    <>
      <PageHero className="ranking-page-hero" label="隐藏榜单" title={`美团 ${eventName}排名`}>
        美团在职及曾经在职员工 WCA 成绩榜单。
      </PageHero>

      <section className="container section local-rankings-section rankings-workspace">
        <section className="weekly-event-section ranking-filter-section">
          <div className="section-header">
            <div>
              <span className="eyebrow">美团筛选</span>
              <h2>内部名单排名查询</h2>
            </div>
          </div>
          <div className="ranking-filter-card local-ranking-filter-card" aria-label="美团排名筛选">
            <div className="ranking-field">
              <span>名单范围</span>
              <div className="ranking-toggle">
                {(["all", "current"] as MemberScope[]).map((item) => (
                  <button
                    className={memberScope === item ? "active" : ""}
                    type="button"
                    onClick={() => updateFilter({ memberScope: item })}
                    key={item}
                  >
                    {memberScopeLabels[item]}
                  </button>
                ))}
              </div>
            </div>

            <label className="ranking-field">
              <span>项目</span>
              <select value={event} onChange={(changeEvent) => updateFilter({ event: changeEvent.target.value })}>
                {eventOptions.map((item) => (
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
                美团 · {memberScopeLabels[memberScope]} · {modeLabels[mode]} · {genderLabels[gender]}
              </span>
              <h2>{eventName}榜单 <small>本页 {rows.length} 人 / 名单 {rankings?.memberCount || 0} 人</small></h2>
            </div>
            <div className="ranking-source-line">
              <MapPin size={16} />
              <span>美团名单</span>
              <Database size={16} />
              <span>WCA PostgreSQL</span>
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
            <table className={`result-table ranking-table local-ranking-results-table ${showGenderRankColumns ? "has-gender-ranks" : ""}`}>
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>状态</th>
                  <th>性别</th>
                  <th>成绩</th>
                  <th>美团排名</th>
                  <th>全国排名</th>
                  <th>世界排名</th>
                  {showGenderRankColumns ? (
                    <>
                      <th>{genderRankLabel}美团排名</th>
                      <th>{genderRankLabel}全国排名</th>
                      <th>{genderRankLabel}世界排名</th>
                    </>
                  ) : null}
                  <th>比赛</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={showGenderRankColumns ? 11 : 8}>加载中...</td>
                  </tr>
                ) : null}
                {!isLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={showGenderRankColumns ? 11 : 8}>当前名单没有可展示的 WCA 排名数据。</td>
                  </tr>
                ) : null}
                {!isLoading
                  ? rows.map((row) => (
                      <tr key={`${mode}-${event}-${row.wcaId}`}>
                        <td data-label="姓名">
                          <Link
                            className="table-person-link"
                            href={`https://www.worldcubeassociation.org/persons/${row.wcaId}`}
                          >
                            {row.name}
                          </Link>
                          <small className="ranking-wca-id">{row.wcaId}</small>
                        </td>
                        <td data-label="状态">
                          <span className={`status ${row.memberStatus === "current" ? "status-高" : "status-低"}`}>
                            {row.memberStatus === "current" ? "在职" : "离职"}
                          </span>
                        </td>
                        <td data-label="性别">{row.gender === "m" ? "男" : row.gender === "f" ? "女" : "-"}</td>
                        <td data-label="成绩" className="score-strong">
                          {row.result}
                          {row.resultDetails?.length ? (
                            <small className="ranking-result-details">{row.resultDetails.join(" / ")}</small>
                          ) : null}
                        </td>
                        <td data-label="美团排名">{row.rank}</td>
                        <td data-label="全国排名">{row.officialRank}</td>
                        <td data-label="世界排名">{row.worldRank}</td>
                        {showGenderRankColumns ? (
                          <>
                            <td data-label={`${genderRankLabel}美团排名`}>{formatRankCell(row.genderGroupRank)}</td>
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
                              <WcaFlag country={row.country} />
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


