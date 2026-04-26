"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { competitionCategories, competitions, getCompetitionCategory } from "@/lib/data";

const pageSize = 20;
const getSortableDate = (date: string) => {
  const match = date.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "0000-00-00";
};
const getShenyangOpenEdition = (slug: string) => {
  const match = slug.match(/^shenyang-open-(\d+)$/);
  return match ? Number(match[1]) : 0;
};

export function CompetitionsClient() {
  const [category, setCategory] = useState("全部");
  const [page, setPage] = useState(1);

  const filteredCompetitions = useMemo(() => {
    return competitions
      .filter((competition) => {
        return category === "全部" || competition.category === category;
      })
      .sort((a, b) => {
        if (a.category === "shenyang-city-open" && b.category === "shenyang-city-open") {
          return getShenyangOpenEdition(b.slug) - getShenyangOpenEdition(a.slug);
        }

        return getSortableDate(b.date).localeCompare(getSortableDate(a.date));
      });
  }, [category]);

  useEffect(() => {
    setPage(1);
  }, [category]);

  const totalPages = Math.max(1, Math.ceil(filteredCompetitions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleCompetitions = filteredCompetitions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = filteredCompetitions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filteredCompetitions.length);

  return (
    <section className="container section competition-list-section">
      <div className="competition-list-panel">
        <div className="competition-filter-row">
          <div className="competition-filter-field competition-filter-field-wide">
            <span>类型</span>
            <div className="competition-filter-toggle competition-category-toggle">
              {[{ id: "全部", shortName: "全部" }, ...competitionCategories].map((item) => (
                <button
                  className={category === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => setCategory(item.id)}
                  type="button"
                >
                  {item.shortName}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="competition-list-count">
          第 {startIndex}-{endIndex} 条，共 {filteredCompetitions.length} 条。
        </p>

        <div className="competition-table-wrap">
          <table className="competition-list-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>比赛类别</th>
                <th>比赛名称</th>
                <th>赞助商</th>
                <th>省份</th>
                <th>城市</th>
                <th>地点</th>
                <th>来源</th>
                <th>公示/查看</th>
              </tr>
            </thead>
            <tbody>
              {visibleCompetitions.map((competition) => {
                const categoryInfo = getCompetitionCategory(competition.category);
                return (
                  <tr key={competition.id}>
                    <td>{competition.date}</td>
                    <td>
                      <span className={`competition-type type-${competition.category}`}>
                        {categoryInfo?.shortName || "未分类"}
                      </span>
                    </td>
                    <td>
                      <Link className="competition-name-link" href={`/competitions/${competition.slug}`}>
                        {competition.name}
                      </Link>
                    </td>
                    <td>{competition.sponsor || "—"}</td>
                    <td>{competition.province}</td>
                    <td>{competition.city}</td>
                    <td>{competition.venue || competition.address}</td>
                    <td>
                      {competition.dataSourceUrl ? (
                        <Link className="competition-source-link" href={competition.dataSourceUrl} target="_blank">
                          <strong>{competition.dataSource || "资料来源"}</strong>
                          <span>查看来源</span>
                        </Link>
                      ) : (
                        <span className="competition-source-pending">
                          <strong>{competition.dataSource || "待补充"}</strong>
                          <span>{competition.dataSource ? "已记录" : "后续整理"}</span>
                        </span>
                      )}
                    </td>
                    <td>
                      {competition.externalUrl ? (
                        <Link className="competition-source-link" href={competition.externalUrl} target="_blank">
                          <strong>{competition.publicPlatform || "外部平台"}</strong>
                          <span>{competition.publicMethod || "点击查看"}</span>
                        </Link>
                      ) : (
                        <span className="competition-source-pending">
                          <strong>{competition.publicPlatform || "待补充"}</strong>
                          <span>{competition.publicMethod || "后续整理"}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibleCompetitions.length === 0 ? (
                <tr>
                  <td colSpan={9}>当前筛选条件下暂无赛事。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="competition-pagination">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
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
