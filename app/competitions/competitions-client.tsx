"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { competitions, getCompetitionCategory, getCompetitionDisplayName } from "@/lib/data";

const pageSize = 20;
const getSortableDate = (date: string) => {
  const match = date.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "0000-00-00";
};
const getShenyangOpenEdition = (slug: string) => {
  const match = slug.match(/^shenyang-open-(\d+)$/);
  return match ? Number(match[1]) : 0;
};

const categoryTabs = [
  { id: "全部", shortName: "全部" },
  { id: "wca-official", shortName: "WCA" },
  { id: "liaoning-province-open", shortName: "省赛" },
  { id: "shenyang-city-open", shortName: "市赛" }
];
const categoryIds = new Set(categoryTabs.map((item) => item.id));

function matchesCategory(competitionCategory: string, selected: string) {
  if (selected === "全部") return true;
  return competitionCategory === selected;
}

function getExternalPlatformLabel(url: string, fallback?: string) {
  if (url.includes("cubing.com")) return "粗饼";
  return fallback || "外部平台";
}

export function CompetitionsClient() {
  const [category, setCategory] = useState("全部");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const requestedCategory = new URLSearchParams(window.location.search).get("category");
    if (requestedCategory && categoryIds.has(requestedCategory)) {
      setCategory(requestedCategory);
    }
  }, []);

  const filteredCompetitions = useMemo(() => {
    return competitions
      .filter((competition) => matchesCategory(competition.category, category))
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
              {categoryTabs.map((item) => (
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
                <th>省份</th>
                <th>城市</th>
                <th>地点</th>
                <th>链接</th>
              </tr>
            </thead>
            <tbody>
              {visibleCompetitions.map((competition) => {
                const categoryInfo = getCompetitionCategory(competition.category);
                const primaryLink = competition.externalUrl
                  ? {
                      href: competition.externalUrl,
                      label: getExternalPlatformLabel(competition.externalUrl, competition.publicPlatform),
                      action: competition.publicMethod || "查看"
                    }
                  : competition.dataSourceUrl
                    ? {
                        href: competition.dataSourceUrl,
                        label: competition.dataSource || "资料来源",
                        action: "查看"
                      }
                    : null;
                return (
                  <tr key={competition.id}>
                    <td data-label="日期">{competition.date}</td>
                    <td data-label="比赛类别">
                      <span className={`competition-type type-${competition.category}`}>
                        {categoryInfo?.shortName || "未分类"}
                      </span>
                    </td>
                    <td data-label="比赛名称">
                      <Link className="competition-name-link" href={`/competitions/${competition.slug}`}>
                        {getCompetitionDisplayName(competition)}
                      </Link>
                    </td>
                    <td data-label="省份">{competition.province}</td>
                    <td data-label="城市">{competition.city}</td>
                    <td data-label="地点">{competition.venue || competition.address}</td>
                    <td data-label="链接">
                      {primaryLink ? (
                        <Link className="competition-source-link" href={primaryLink.href} target="_blank">
                          <strong>{primaryLink.label}</strong>
                          <span>{primaryLink.action}</span>
                        </Link>
                      ) : (
                        <span className="competition-source-pending">
                          <strong>{competition.dataSource || "待补充"}</strong>
                          <span>后续整理</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibleCompetitions.length === 0 ? (
                <tr>
                  <td colSpan={7}>当前筛选条件下暂无赛事。</td>
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
