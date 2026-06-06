"use client";

import { CalendarDays, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { LiaoningCompetition } from "@/lib/liaoning-competitions";

const pageSize = 20;

export function LiaoningCompetitionsClient({
  initialCompetitions
}: {
  initialCompetitions: LiaoningCompetition[];
}) {
  const [keyword, setKeyword] = useState("");
  const [year, setYear] = useState("全部");
  const [page, setPage] = useState(1);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const competition of initialCompetitions) {
      if (competition.year > 0) set.add(competition.year);
    }
    return ["全部", ...Array.from(set).sort((a, b) => b - a).map(String)];
  }, [initialCompetitions]);

  const filtered = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return initialCompetitions.filter((competition) => {
      if (year !== "全部" && String(competition.year) !== year) return false;
      if (!term) return true;
      return (
        competition.name.toLowerCase().includes(term) ||
        competition.nameZh.toLowerCase().includes(term) ||
        competition.city.toLowerCase().includes(term) ||
        competition.playerNames.some((name) => name.toLowerCase().includes(term))
      );
    });
  }, [initialCompetitions, keyword, year]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filtered.length);

  const totalPlayers = useMemo(() => {
    const set = new Set<string>();
    for (const competition of initialCompetitions) {
      for (const name of competition.playerNames) set.add(name);
    }
    return set.size;
  }, [initialCompetitions]);

  const totalEntries = useMemo(
    () => initialCompetitions.reduce((total, competition) => total + competition.playerCount, 0),
    [initialCompetitions]
  );

  const yearRange = useMemo(() => {
    const competitionYears = initialCompetitions
      .map((competition) => competition.year)
      .filter((value) => value > 0)
      .sort((a, b) => a - b);
    if (competitionYears.length === 0) return "暂无";
    const first = competitionYears[0];
    const last = competitionYears[competitionYears.length - 1];
    return first === last ? String(first) : `${first}–${last}`;
  }, [initialCompetitions]);

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <section className="container section competition-list-section liaoning-competitions-section">
      <div className="liaoning-competition-overview">
        <div className="liaoning-competition-intro">
          <span className="eyebrow">WCA 参赛足迹</span>
          <h2>辽宁选手的赛事参与统计</h2>
          <p>以本站辽宁选手名单为基础，汇总他们参加过的 WCA 正式比赛。可按赛事、城市、年份或选手姓名查询。</p>
        </div>
        <div className="liaoning-competition-stats">
          <div className="liaoning-competition-stat">
            <CalendarDays size={19} />
            <span>收录赛事</span>
            <strong>{initialCompetitions.length}</strong>
          </div>
          <div className="liaoning-competition-stat">
            <Users size={19} />
            <span>辽宁选手</span>
            <strong>{totalPlayers}</strong>
          </div>
          <div className="liaoning-competition-stat">
            <span className="liaoning-competition-stat-mark">Σ</span>
            <span>累计人次</span>
            <strong>{totalEntries}</strong>
          </div>
          <div className="liaoning-competition-stat">
            <span className="liaoning-competition-stat-mark">年</span>
            <span>赛事年份</span>
            <strong className="liaoning-competition-year-range">{yearRange}</strong>
          </div>
        </div>
      </div>

      <div className="competition-list-panel liaoning-competition-panel">
        <div className="liaoning-competition-toolbar">
          <label className="liaoning-competition-search">
            <Search size={17} />
            <input
              type="search"
              value={keyword}
              onChange={(event) => resetPage(setKeyword)(event.target.value)}
              placeholder="搜索赛事、城市或选手姓名"
            />
          </label>
          <label className="liaoning-competition-year">
            <span>年份</span>
            <select value={year} onChange={(event) => resetPage(setYear)(event.target.value)}>
              {years.map((item) => (
                <option key={item} value={item}>
                  {item === "全部" ? "全部年份" : item}
                </option>
              ))}
            </select>
          </label>
          <span className="liaoning-competition-result-count">
            共 <strong>{filtered.length}</strong> 场赛事
          </span>
        </div>

        <p className="competition-list-count liaoning-competition-list-count">
          第 {startIndex}-{endIndex} 条，共 {filtered.length} 条。
        </p>

        {initialCompetitions.length === 0 ? (
          <p className="competition-list-empty">
            暂无数据。该页面依赖 WCA 同步数据库，请确认服务器已配置 DATABASE_URL 并完成 WCA 同步。
          </p>
        ) : null}

        <div className="competition-table-wrap liaoning-competition-table-wrap">
          <table className="competition-list-table liaoning-competition-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>赛事名称</th>
                <th>城市</th>
                <th>辽宁参赛</th>
                <th>辽宁参赛选手</th>
                <th>WCA</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((competition) => (
                <tr key={competition.id}>
                  <td data-label="日期">
                    <span className="liaoning-competition-date">{competition.date || "—"}</span>
                  </td>
                  <td data-label="赛事名称">
                    <strong className="liaoning-competition-name">{competition.nameZh}</strong>
                    {competition.nameZh !== competition.name ? (
                      <span className="competition-name-en">{competition.name}</span>
                    ) : null}
                  </td>
                  <td data-label="城市">{competition.city || "—"}</td>
                  <td data-label="辽宁参赛">
                    <span className="liaoning-player-count">{competition.playerCount} 人</span>
                  </td>
                  <td data-label="辽宁参赛选手">
                    <div className="liaoning-player-list">
                      {competition.playerNames.map((name) => (
                        <span key={name}>{name}</span>
                      ))}
                    </div>
                  </td>
                  <td data-label="WCA">
                    <a
                      className="competition-source-link"
                      href={`https://www.worldcubeassociation.org/competitions/${competition.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <strong>WCA</strong>
                      <span>查看成绩</span>
                    </a>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && initialCompetitions.length > 0 ? (
                <tr>
                  <td colSpan={6}>当前筛选条件下暂无赛事。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="competition-pagination">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>
            上一页
          </button>
          <span>
            第 {currentPage} / {totalPages} 页
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={currentPage === totalPages}
          >
            下一页
          </button>
        </div>
      </div>
    </section>
  );
}
