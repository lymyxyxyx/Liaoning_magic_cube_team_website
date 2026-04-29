"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Database, ExternalLink, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHero } from "@/components/page-hero";

type RankingMode = "single" | "average";
type Gender = "all" | "m" | "f";
type Scope = "province" | "city";

type MetadataOption = {
  id: string;
  name: string;
};

type LocalRankingRow = {
  rank: number;
  officialRank: number;
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
  const [event, setEvent] = useState("333");
  const [province, setProvince] = useState("辽宁");
  const [city, setCity] = useState("沈阳");
  const [scope, setScope] = useState<Scope>("city");
  const [mode, setMode] = useState<RankingMode>("single");
  const [gender, setGender] = useState<Gender>("all");
  const [page, setPage] = useState(1);
  const [rankings, setRankings] = useState<LocalRankingsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [contactMessage, setContactMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wca-metadata")
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        setEvents(payload.events || []);
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

  function updateFilter(next: Partial<{ event: string; province: string; city: string; scope: Scope; mode: RankingMode; gender: Gender }>) {
    if (next.event) setEvent(next.event);
    if (next.province) setProvince(next.province);
    if (next.city) setCity(next.city);
    if (next.scope) setScope(next.scope);
    if (next.mode) setMode(next.mode);
    if (next.gender) setGender(next.gender);
    setPage(1);
  }

  function sendEligibilityMail() {
    const subject = "辽宁排名名单反馈";
    const body = contactMessage.trim()
      ? contactMessage.trim()
      : "您好，我想反馈辽宁排名名单信息：\n\n姓名：\nWCA ID：\n省市归属说明：\n联系方式：";
    window.location.href = `mailto:499949970@qq.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <>
      <PageHero label="本地省市归属" title={`${areaLabel} ${eventName}排名`}>
        基于本站维护的省市归属名单，关联 WCA 官方成绩生成本地榜单；当前先录入 10 位辽宁沈阳选手。
      </PageHero>

      <section className="container section local-rankings-section">
        <div className="weekly-intro">
          <p>
            当前展示 {areaLabel} · {eventName} · {modeLabels[mode]} · {genderLabels[gender]}。
          </p>
          <strong>省市归属只在本站维护，WCA 官方数据不包含省份和城市字段。</strong>
        </div>

        <section className="local-eligibility-card">
          <div>
            <span className="eyebrow">入围范围</span>
            <h2>辽宁排名认定说明</h2>
            <ol>
              <li>户口本或身份证显示为辽宁户籍。</li>
              <li>户口本或身份证曾为辽宁户籍，后已取得外省或外国身份。</li>
              <li>户口本或身份证曾不是辽宁户籍，但现已取得辽宁省户籍。</li>
            </ol>
          </div>
          <div className="local-contact-box">
            <label htmlFor="liaoning-ranking-message">名单反馈</label>
            <textarea
              id="liaoning-ranking-message"
              placeholder="如果满足条件但缺少您的名字，或不想参与排名，请在这里填写姓名、WCA ID、情况说明和联系方式。"
              value={contactMessage}
              onChange={(event) => setContactMessage(event.target.value)}
            />
            <button className="button primary" type="button" onClick={sendEligibilityMail}>
              发送邮件
            </button>
          </div>
        </section>

        <div className="weekly-summary-grid">
          <div className="stat">
            <strong>{scopeLabels[scope]}</strong>
            <span>榜单类型</span>
          </div>
          <div className="stat">
            <strong>{areaLabel}</strong>
            <span>当前区域</span>
          </div>
          <div className="stat">
            <strong>{eventName}</strong>
            <span>当前项目</span>
          </div>
          <div className="stat">
            <strong>{rows.length}</strong>
            <span>本页有成绩选手</span>
          </div>
        </div>

        <section className="weekly-event-section">
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
                {scopeLabels[scope]} · {modeLabels[mode]}
              </span>
              <h2>{areaLabel}榜单</h2>
            </div>
            <div className="ranking-source-line">
              <MapPin size={16} />
              <span>本站省市归属</span>
              <Database size={16} />
              <span>WCA PostgreSQL</span>
            </div>
          </div>

          {error ? <div className="wca-state">{error}</div> : null}

          <div className="result-table-wrap">
            <table className="result-table ranking-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>性别</th>
                  <th>成绩</th>
                  <th>省市</th>
                  <th>{scopeLabels[scope]}</th>
                  <th>全国排名</th>
                  <th>世界排名</th>
                  <th>比赛</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8}>加载中...</td>
                  </tr>
                ) : null}
                {!isLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>当前筛选没有辽宁本地排名数据。</td>
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
