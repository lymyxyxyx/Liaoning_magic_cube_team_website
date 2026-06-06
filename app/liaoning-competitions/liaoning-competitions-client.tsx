"use client";

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

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <section className="container section competition-list-section">
      <div className="competition-list-panel">
        <div className="result-stats-grid">
          <div className="result-stat-card">
            <span className="result-stat-label">收录赛事</span>
            <strong className="result-stat-value">{initialCompetitions.length}</strong>
          </div>
          <div className="result-stat-card">
            <span className="result-stat-label">涉及辽宁选手</span>
            <strong className="result-stat-value">{totalPlayers}</strong>
          </div>
          <div className="result-stat-card">
            <span className="result-stat-label">年份跨度</span>
            <strong className="result-stat-value">{years.length > 1 ? `${years.length - 1}` : "0"}</strong>
          </div>
        </div>

        <div className="competition-filter-row">
          <div className="competition-filter-field competition-filter-field-wide">
            <span>搜索</span>
            <input
              type="search"
              value={keyword}
              onChange={(event) => resetPage(setKeyword)(event.target.value)}
              placeholder="按赛事名称、城市或选手姓名搜索"
            />
          </div>
          <div className="competition-filter-field">
            <span>年份</span>
            <select value={year} onChange={(event) => resetPage(setYear)(event.target.value)}>
              {years.map((item) => (
                <option key={item} value={item}>
                  {item === "全部" ? "全部年份" : item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="competition-list-count">
          第 {startIndex}-{endIndex} 条，共 {filtered.length} 条。
        </p>

        {initialCompetitions.length === 0 ? (
          <p className="competition-list-empty">
            暂无数据。该页面依赖 WCA 同步数据库，请确认服务器已配置 DATABASE_URL 并完成 WCA 同步。
          </p>
        ) : null}

        <div className="competition-table-wrap">
          <table className="competition-list-table">
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
                  <td data-label="日期">{competition.date || "—"}</td>
                  <td data-label="赛事名称">
                    <strong>{competition.nameZh}</strong>
                    {competition.nameZh !== competition.name ? (
                      <span className="competition-name-en">{competition.name}</span>
                    ) : null}
                  </td>
                  <td data-label="城市">{competition.city || "—"}</td>
                  <td data-label="辽宁参赛">{competition.playerCount}</td>
                  <td data-label="辽宁参赛选手">{competition.playerNames.join("、") || "—"}</td>
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
