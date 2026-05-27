"use client";

import { useEffect, useRef, useState } from "react";
import type { NationalAllAroundRow, NationalRelayRow, NationalResultRow } from "@/lib/national-results";

function openTargetDetails(hash: string) {
  if (!hash) return;
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  const target = document.getElementById(id);
  if (target instanceof HTMLDetailsElement) {
    target.open = true;
    target.dispatchEvent(new Event("toggle"));
    target.scrollIntoView({ block: "start" });
  }
}

export function NationalResultsClient() {
  useEffect(() => {
    openTargetDetails(window.location.hash);

    function handleHashChange() {
      openTargetDetails(window.location.hash);
    }

    function handleClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href^='#']");
      if (!link) return;
      openTargetDetails(link.hash);
    }

    window.addEventListener("hashchange", handleHashChange);
    document.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return null;
}

type LazyTableProps =
  | {
      kind: "single";
      station: string;
      event: string;
      group: string;
      initialRows?: NationalResultRow[];
    }
  | {
      kind: "all-around";
      station: string;
      event: string;
      group: string;
      initialRows?: NationalAllAroundRow[];
    }
  | {
      kind: "relay";
      station: string;
      group: string;
      initialRows?: NationalRelayRow[];
    };

function isShenyangTeam(team: string) {
  return team.includes("沈阳市魔方代表队");
}

export function LazyNationalResultsTable(props: LazyTableProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(props.initialRows || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const eventName = "event" in props ? props.event : "";
  const lazyKey = `${props.kind}-${props.group}-${eventName || "relay"}`;

  useEffect(() => {
    async function loadRows() {
      if (rows.length > 0) return;
      setIsLoading(true);
      setError("");
      const params = new URLSearchParams({
        station: props.station,
        kind: props.kind,
        group: props.group
      });
      if (eventName) params.set("event", eventName);

      try {
        const response = await fetch(`/api/national-results?${params.toString()}`);
        if (!response.ok) throw new Error("load failed");
        const data = (await response.json()) as { rows: typeof rows };
        setRows(data.rows);
      } catch {
        setError("成绩加载失败，请刷新后再试");
      } finally {
        setIsLoading(false);
      }
    }

    const details = hostRef.current?.closest("details");
    if (!details) {
      void loadRows();
      return;
    }

    function handleToggle() {
      if ((details as HTMLDetailsElement).open) void loadRows();
    }

    details.addEventListener("toggle", handleToggle);
    handleToggle();

    return () => details.removeEventListener("toggle", handleToggle);
  }, [eventName, props.group, props.kind, props.station, rows.length]);

  if (error) {
    return <div ref={hostRef} data-lazy-results={lazyKey} className="national-results-loading">{error}</div>;
  }

  if (isLoading && rows.length === 0) {
    return <div ref={hostRef} data-lazy-results={lazyKey} className="national-results-loading">加载成绩中...</div>;
  }

  if (rows.length === 0) {
    return <div ref={hostRef} data-lazy-results={lazyKey} className="national-results-loading">展开后加载成绩</div>;
  }

  if (props.kind === "single") {
    const singleRows = rows as NationalResultRow[];
    return (
      <div ref={hostRef} data-lazy-results={lazyKey} className="national-qualifier-table-wrap">
        <table className="national-result-table">
          <thead>
            <tr>
              <th>名次</th>
              <th>姓名</th>
              <th>性别</th>
              <th>代表队</th>
              <th>第一次</th>
              <th>第二次</th>
              <th>第三次</th>
              <th>{props.event === "三盲" ? "最终成绩（三次最佳）" : "最终成绩（三次平均）"}</th>
            </tr>
          </thead>
          <tbody>
            {singleRows.map((row, rowIndex) => (
              <tr
                className={isShenyangTeam(row.team) ? "shenyang-team-row" : undefined}
                key={`${props.event}-${props.group}-${row.rank || rowIndex}-${row.name}`}
              >
                <td data-label="名次">{row.rank || "-"}</td>
                <td data-label="姓名">{row.name}</td>
                <td data-label="性别">{row.gender}</td>
                <td data-label="代表队">{row.team}</td>
                <td data-label="第一次">{row.first || "-"}</td>
                <td data-label="第二次">{row.second || "-"}</td>
                <td data-label="第三次">{row.third || "-"}</td>
                <td data-label={props.event === "三盲" ? "最终成绩（三次最佳）" : "最终成绩（三次平均）"}>{row.final || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (props.kind === "all-around") {
    const allAroundRows = rows as NationalAllAroundRow[];
    return (
      <div ref={hostRef} data-lazy-results={lazyKey} className="national-qualifier-table-wrap">
        <table className="national-all-around-table">
          <thead>
            <tr>
              <th>名次</th>
              <th>姓名</th>
              <th>性别</th>
              <th>代表队</th>
              <th>最终成绩</th>
            </tr>
          </thead>
          <tbody>
            {allAroundRows.map((row, rowIndex) => (
              <tr
                className={isShenyangTeam(row.team) ? "shenyang-team-row" : undefined}
                key={`${props.event}-${props.group}-${row.rank || rowIndex}-${row.name}`}
              >
                <td data-label="名次">{row.rank || "-"}</td>
                <td data-label="姓名">{row.name}</td>
                <td data-label="性别">{row.gender}</td>
                <td data-label="代表队">{row.team}</td>
                <td data-label="最终成绩">{row.final}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const relayRows = rows as NationalRelayRow[];
  return (
    <div ref={hostRef} data-lazy-results={lazyKey} className="national-qualifier-table-wrap">
      <table className="national-relay-table">
        <thead>
          <tr>
            <th>名次</th>
            <th>代表队</th>
            <th>组别</th>
            <th>队长</th>
            <th>队员</th>
            <th>最终成绩</th>
          </tr>
        </thead>
        <tbody>
          {relayRows.map((row) => (
            <tr
              className={isShenyangTeam(row.team) ? "shenyang-team-row" : undefined}
              key={`${props.group}-${row.rank}-${row.team}-${row.captain}`}
            >
              <td data-label="名次">{row.rank}</td>
              <td data-label="代表队">{row.team}</td>
              <td data-label="组别">{row.group}</td>
              <td data-label="队长">{row.captain}</td>
              <td data-label="队员">{row.members.join("、")}</td>
              <td data-label="最终成绩">{row.final}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
