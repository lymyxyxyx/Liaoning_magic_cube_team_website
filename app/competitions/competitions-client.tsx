"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { eventCategoryLabels, eventCategoryOrder, type EventCategory, type EventListRow } from "@/lib/event-types";

const pageSize = 20;

type TabId = "all" | EventCategory;

const tabs: { id: TabId; label: string }[] = [
  { id: "all", label: "全部" },
  ...eventCategoryOrder.map((category) => ({ id: category, label: eventCategoryLabels[category] }))
];

export function CompetitionsClient({ initialEvents }: { initialEvents: EventListRow[] }) {
  const [tab, setTab] = useState<TabId>("all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("category");
    const map: Record<string, TabId> = {
      wca: "wca",
      province: "province",
      city: "city",
      national: "national",
      "shenyang-city-open": "city",
      "liaoning-province-open": "province"
    };
    if (requested && map[requested]) setTab(map[requested]);
  }, []);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: initialEvents.length };
    for (const category of eventCategoryOrder) {
      result[category] = initialEvents.filter((event) => event.category === category).length;
    }
    return result;
  }, [initialEvents]);

  const filtered = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return initialEvents.filter((event) => {
      if (tab !== "all" && event.category !== tab) return false;
      if (!term) return true;
      return event.name.toLowerCase().includes(term) || event.location.toLowerCase().includes(term);
    });
  }, [initialEvents, tab, keyword]);

  useEffect(() => {
    setPage(1);
  }, [tab, keyword]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startIndex = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filtered.length);

  return (
    <section className="container section event-list-section">
      <div className="event-list-panel">
        <div className="event-tab-row">
          <div className="event-tabs">
            {tabs.map((item) => (
              <button
                className={tab === item.id ? "active" : ""}
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
              >
                {item.label}
                <span className="event-tab-count">{counts[item.id] ?? 0}</span>
              </button>
            ))}
          </div>
          <input
            className="event-search"
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索赛事名称或地点"
          />
        </div>

        <p className="event-list-count">
          第 {startIndex}-{endIndex} 条，共 {filtered.length} 条。
        </p>

        <div className="event-table-wrap">
          <table className="event-list-table">
            <thead>
              <tr>
                <th className="col-date">日期</th>
                <th className="col-cat">类别</th>
                <th className="col-name">赛事名称</th>
                <th className="col-loc">地点</th>
                <th className="col-link">查看</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((event) => (
                <tr key={event.id}>
                  <td className="col-date" data-label="日期">
                    {event.date || "—"}
                  </td>
                  <td className="col-cat" data-label="类别">
                    <span className={`event-chip event-chip-${event.category}`}>
                      {eventCategoryLabels[event.category]}
                    </span>
                  </td>
                  <td className="col-name" data-label="赛事名称">
                    {event.external ? (
                      <span className="event-name">{event.name}</span>
                    ) : (
                      <Link className="event-name event-name-link" href={event.href}>
                        {event.name}
                      </Link>
                    )}
                  </td>
                  <td className="col-loc" data-label="地点">
                    {event.location || "—"}
                  </td>
                  <td className="col-link" data-label="查看">
                    {event.external ? (
                      <a className="event-link" href={event.href} target="_blank" rel="noopener noreferrer">
                        WCA ↗
                      </a>
                    ) : (
                      <Link className="event-link" href={event.href}>
                        {event.category === "national" ? "专题" : "详情"}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="event-empty">
                    当前筛选条件下暂无赛事。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="event-pagination">
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
