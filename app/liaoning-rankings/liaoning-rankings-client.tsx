"use client";

import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Database, ExternalLink, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHero } from "@/components/page-hero";

type RankingMode = "single" | "average";
type Gender = "all" | "m" | "f";
type Scope = "province" | "city";
type FeedbackStatus = "idle" | "submitting" | "success" | "error";

type MetadataOption = {
  id: string;
  name: string;
};

type LocalRankingRow = {
  rank: number;
  officialRank: number;
  worldRank: number;
  genderLocalRank: number | null;
  genderOfficialRank: number | null;
  genderWorldRank: number | null;
  wcaId: string;
  name: string;
  country: string;
  countryName: string;
  gender: string;
  result: string;
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
  all: "所有",
  m: "男",
  f: "女"
};

const scopeLabels: Record<Scope, string> = {
  province: "省排名",
  city: "市排名"
};

function WcaFlag({ country }: { country: string }) {
  return <span className={`wca-flag flag-${country.toLowerCase().replaceAll(" ", "-")}`} aria-hidden="true" />;
}

export function LiaoningRankingsClient() {
  const [events, setEvents] = useState<MetadataOption[]>([]);
  const [lastExportDate, setLastExportDate] = useState("");
  const [event, setEvent] = useState("333");
  const [province, setProvince] = useState("辽宁");
  const [city, setCity] = useState("沈阳");
  const [scope, setScope] = useState<Scope>("city");
  const [mode, setMode] = useState<RankingMode>("average");
  const [gender, setGender] = useState<Gender>("all");
  const [page, setPage] = useState(1);
  const [rankings, setRankings] = useState<LocalRankingsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState({
    type: "名单反馈",
    name: "",
    wcaId: "",
    contact: "",
    message: "",
    website: ""
  });
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>("idle");
  const [feedbackNotice, setFeedbackNotice] = useState("");

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
        if (!cancelled) setError("无法读取 WCA 项目列表。");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
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
    fetch(`/api/local-rankings?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("rankings");
        return response.json();
      })
      .then((payload: LocalRankingsResponse) => {
        setRankings(payload);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setError("无法读取辽宁排名数据，请确认 WCA 数据库已同步。");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [event, province, city, scope, mode, gender, page]);

  const eventName = useMemo(() => events.find((item) => item.id === event)?.name || event, [events, event]);
  const rows = rankings?.rows || [];
  const provinces = rankings?.provinces?.length ? rankings.provinces : ["辽宁"];
  const cities = rankings?.cities?.length ? rankings.cities : ["沈阳"];
  const areaLabel = scope === "province" ? `${province}省` : `${city}市`;
  const updateDateLabel = formatWcaExportDate(lastExportDate);
  const showGenderRankColumns = gender !== "all";
  const genderRankLabel = gender === "m" ? "男子" : "女子";

  function updateFilter(next: Partial<{ event: string; province: string; city: string; scope: Scope; mode: RankingMode; gender: Gender }>) {
    if (next.event) setEvent(next.event);
    if (next.province) setProvince(next.province);
    if (next.city) setCity(next.city);
    if (next.scope) setScope(next.scope);
    if (next.mode) setMode(next.mode);
    if (next.gender) setGender(next.gender);
    setPage(1);
  }

  function submitFeedback() {
    const message = feedback.message.trim();
    if (message.length < 4) {
      setFeedbackStatus("error");
      setFeedbackNotice("请先填写反馈内容。");
      return;
    }

    setFeedbackStatus("submitting");
    setFeedbackNotice("");
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...feedback, pageUrl: window.location.pathname })
    })
      .then((response) => {
        if (!response.ok) throw new Error("feedback");
        return response.json();
      })
      .then(() => {
        setFeedback({
          type: "名单反馈",
          name: "",
          wcaId: "",
          contact: "",
          message: "",
          website: ""
        });
        setFeedbackStatus("success");
        setFeedbackNotice("已收到反馈，我们会在核实后更新名单或数据。");
      })
      .catch(() => {
        setFeedbackStatus("error");
        setFeedbackNotice("提交失败，请稍后再试。");
      });
  }

  return (
    <>
      <PageHero className="ranking-page-hero" label="本地省市归属" title={`${areaLabel} ${eventName}排名`}>
        本站省市归属名单关联 WCA 官方成绩。
      </PageHero>

      <section className="container section local-rankings-section rankings-workspace">
        <details className="local-eligibility-card compact-local-eligibility">
          <summary>辽宁排名认定说明与名单反馈</summary>
          <div className="compact-local-eligibility-body">
            <ol>
              <li>户口本或身份证显示为辽宁户籍。</li>
              <li>户口本或身份证曾为辽宁户籍，后已取得外省或外国身份。</li>
              <li>户口本或身份证曾不是辽宁户籍，但现已取得辽宁省户籍。</li>
            </ol>
            <div className="local-contact-box">
              <label htmlFor="liaoning-ranking-message">名单反馈</label>
              <select
                aria-label="反馈类型"
                value={feedback.type}
                onChange={(event) => setFeedback({ ...feedback, type: event.target.value })}
              >
                {["名单反馈", "成绩问题", "页面问题", "合作咨询", "其他"].map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input
                placeholder="姓名，可选"
                value={feedback.name}
                onChange={(event) => setFeedback({ ...feedback, name: event.target.value })}
              />
              <input
                placeholder="WCA ID，可选"
                value={feedback.wcaId}
                onChange={(event) => setFeedback({ ...feedback, wcaId: event.target.value.toUpperCase() })}
              />
              <input
                placeholder="联系方式，可选"
                value={feedback.contact}
                onChange={(event) => setFeedback({ ...feedback, contact: event.target.value })}
              />
              <input
                className="feedback-honeypot"
                tabIndex={-1}
                autoComplete="off"
                value={feedback.website}
                onChange={(event) => setFeedback({ ...feedback, website: event.target.value })}
              />
              <textarea
                id="liaoning-ranking-message"
                placeholder="填写姓名、WCA ID、情况说明和联系方式。"
                value={feedback.message}
                onChange={(event) => setFeedback({ ...feedback, message: event.target.value })}
              />
              <button className="button primary" type="button" disabled={feedbackStatus === "submitting"} onClick={submitFeedback}>
                {feedbackStatus === "submitting" ? "提交中" : "提交反馈"}
              </button>
              {feedbackNotice ? <p className={`feedback-notice ${feedbackStatus === "error" ? "error" : ""}`}>{feedbackNotice}</p> : null}
            </div>
          </div>
        </details>

        <section className="weekly-event-section ranking-filter-section">
          <div className="section-header">
            <div>
              <span className="eyebrow">本地筛选</span>
              <h2>省市排名查询</h2>
            </div>
          </div>
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
                {areaLabel} · {scopeLabels[scope]} · {modeLabels[mode]} · {genderLabels[gender]}
              </span>
              <h2>{eventName}榜单 <small>本页 {rows.length} 人</small></h2>
            </div>
            <div className="ranking-source-line">
              <MapPin size={16} />
              <span>本站省市归属</span>
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
                  <th>性别</th>
                  <th>成绩</th>
                  <th>省市</th>
                  <th>{scopeLabels[scope]}</th>
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
                    <td colSpan={showGenderRankColumns ? 11 : 8}>当前筛选没有辽宁本地排名数据。</td>
                  </tr>
                ) : null}
                {!isLoading
                  ? rows.map((row) => (
                      <tr key={`${scope}-${mode}-${event}-${row.wcaId}`}>
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
                        <td>{row.province} · {row.city}</td>
                        <td>{row.rank}</td>
                        <td>{row.officialRank}</td>
                        <td>{row.worldRank}</td>
                        {showGenderRankColumns ? (
                          <>
                            <td>{formatRankCell(row.genderLocalRank)}</td>
                            <td>{formatRankCell(row.genderOfficialRank)}</td>
                            <td>{formatRankCell(row.genderWorldRank)}</td>
                          </>
                        ) : null}
                        <td>
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

function formatRankCell(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : "-";
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
