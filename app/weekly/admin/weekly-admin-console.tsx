"use client";

import Link from "next/link";
import { Download, Eye, Save, Table2 } from "lucide-react";
import { useMemo, useState } from "react";

type ParsedResult = {
  rank: number;
  playerName: string;
  gender: "男" | "女";
  ageGroup: string;
  level: string;
  grade: string;
  average: number;
  personalBest: number;
  pbRefreshed: boolean;
  attempts: (number | "DNF")[];
};

const sampleRows = `姓名\t性别\t年龄组\t段位\t等级\t平均\t个人PB\tT1\tT2\tT3\tT4\tT5\t刷新PB
张三\t男\tU8\t一段\tA\t12.34\t11.88\t12.10\t12.45\tDNF\t12.30\t12.28\t是
李四\t女\tU10\t二段\tB\t13.56\t13.20\t13.70\t13.40\t13.60\t13.55\t13.50\t否`;

export function WeeklyAdminConsole() {
  const currentYear = new Date().getFullYear();
  const [meta, setMeta] = useState({
    weekNumber: "",
    year: String(currentYear),
    yearWeek: "",
    publishedAt: new Date().toISOString().slice(0, 10),
    dateLabel: "",
    event: "三阶",
    summary: "",
    intro: "",
    pbNote: "下表中个人 PB 部分标红的为本周刷新的成绩。",
    threeAgeIntro: "三阶为周赛主要项目，后续可继续补充年龄组榜单。"
  });
  const [rawText, setRawText] = useState(sampleRows);
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const parsed = useMemo(() => parseWeeklyRows(rawText), [rawText]);
  const sortedRows = parsed.rows;

  function saveMeet() {
    setNotice("");
    if (parsed.errors.length > 0) {
      setNotice(`请先修正 ${parsed.errors.length} 个解析问题。`);
      return;
    }
    if (sortedRows.length === 0) {
      setNotice("请先粘贴成绩数据。");
      return;
    }

    setIsSaving(true);
    fetch("/api/weekly-admin/meets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekNumber: Number(meta.weekNumber),
        year: Number(meta.year),
        yearWeek: Number(meta.yearWeek),
        publishedAt: meta.publishedAt,
        dateLabel: meta.dateLabel,
        event: meta.event,
        summary: meta.summary,
        intro: meta.intro
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        pbNote: meta.pbNote,
        threeAgeIntro: meta.threeAgeIntro,
        results: sortedRows
      })
    })
      .then((response) => {
        if (!response.ok) throw new Error("save");
        return response.json();
      })
      .then((payload) => {
        setNotice(`已保存 ${payload.count} 条成绩。`);
        window.setTimeout(() => {
          window.location.href = `/weekly/${payload.slug}`;
        }, 600);
      })
      .catch(() => setNotice("保存失败，请检查周赛口令、数据库连接或录入内容。"))
      .finally(() => setIsSaving(false));
  }

  function exportCsv() {
    if (sortedRows.length === 0) {
      setNotice("没有可导出的成绩。");
      return;
    }
    const header = ["排名", "姓名", "性别", "年龄组", "段位", "等级", "平均", "个人PB", "刷新PB", "T1", "T2", "T3", "T4", "T5"];
    const lines = [
      header,
      ...sortedRows.map((row) => [
        row.rank,
        row.playerName,
        row.gender,
        row.ageGroup,
        row.level,
        row.grade,
        row.average.toFixed(2),
        row.personalBest.toFixed(2),
        row.pbRefreshed ? "是" : "否",
        ...row.attempts.map((attempt) => (attempt === "DNF" ? "DNF" : attempt.toFixed(2)))
      ])
    ];
    const csv = lines.map((line) => line.map(csvCell).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `weekly-${meta.weekNumber || "results"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="container section weekly-admin-shell">
      <div className="admin-card weekly-admin-card">
        <div className="admin-card-heading">
          <div>
            <h2>周赛信息</h2>
            <p>保存后会覆盖同周次的周赛数据。</p>
          </div>
        </div>
        <div className="weekly-admin-grid">
          <Field label="总周次" value={meta.weekNumber} onChange={(value) => setMeta({ ...meta, weekNumber: value })} />
          <Field label="年份" value={meta.year} onChange={(value) => setMeta({ ...meta, year: value })} />
          <Field label="年度周次" value={meta.yearWeek} onChange={(value) => setMeta({ ...meta, yearWeek: value })} />
          <Field label="发布时间" type="date" value={meta.publishedAt} onChange={(value) => setMeta({ ...meta, publishedAt: value })} />
          <Field label="周赛周期" value={meta.dateLabel} onChange={(value) => setMeta({ ...meta, dateLabel: value })} placeholder="例如 2026.05.01-05.07" />
          <Field label="项目" value={meta.event} onChange={(value) => setMeta({ ...meta, event: value })} />
          <Field label="摘要" value={meta.summary} onChange={(value) => setMeta({ ...meta, summary: value })} full />
          <Field label="正文说明" value={meta.intro} onChange={(value) => setMeta({ ...meta, intro: value })} textarea full />
          <Field label="PB 说明" value={meta.pbNote} onChange={(value) => setMeta({ ...meta, pbNote: value })} full />
        </div>
      </div>

      <div className="admin-card weekly-admin-card">
        <div className="admin-card-heading">
          <div>
            <h2>粘贴成绩表</h2>
            <p>从 Excel 复制表头和数据后直接粘贴，支持姓名、性别、年龄组、段位、等级、平均、个人PB、T1-T5、刷新PB。</p>
          </div>
          <span className="admin-local-count">{sortedRows.length} 条</span>
        </div>
        <textarea className="weekly-paste-box" value={rawText} onChange={(event) => setRawText(event.target.value)} />
        {parsed.errors.length > 0 ? (
          <div className="weekly-parse-errors">
            {parsed.errors.slice(0, 6).map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}
        <div className="admin-entry-actions weekly-admin-actions">
          <button className="button" type="button" onClick={exportCsv}>
            <Download size={17} />
            导出 CSV（Excel）
          </button>
          <button className="button primary" disabled={isSaving} type="button" onClick={saveMeet}>
            <Save size={17} />
            {isSaving ? "保存中" : "保存并生成周赛"}
          </button>
          <Link className="button" href="/weekly">
            <Eye size={17} />
            查看周赛页
          </Link>
        </div>
        {notice ? <p className="admin-inline-notice">{notice}</p> : null}
      </div>

      <section className="weekly-event-section">
        <div className="section-header">
          <div>
            <span className="eyebrow">预览</span>
            <h2>生成成绩表</h2>
          </div>
          <Table2 size={20} />
        </div>
        <div className="result-table-wrap">
          <table className="result-table weekly-admin-preview">
            <thead>
              <tr>
                <th>排名</th>
                <th>姓名</th>
                <th>性别</th>
                <th>年龄组</th>
                <th>段位</th>
                <th>等级</th>
                <th>平均</th>
                <th>个人 PB</th>
                <th>T1</th>
                <th>T2</th>
                <th>T3</th>
                <th>T4</th>
                <th>T5</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={`${row.rank}-${row.playerName}`}>
                  <td>{row.rank}</td>
                  <td>{row.playerName}</td>
                  <td>{row.gender}</td>
                  <td>{row.ageGroup || "-"}</td>
                  <td>{row.level || "-"}</td>
                  <td>{row.grade || "-"}</td>
                  <td className="score-strong">{row.average.toFixed(2)}</td>
                  <td className={row.pbRefreshed ? "pb-cell pb-refreshed" : ""}>{row.personalBest.toFixed(2)}</td>
                  {row.attempts.map((attempt, index) => (
                    <td key={index}>{attempt === "DNF" ? "DNF" : attempt.toFixed(2)}</td>
                  ))}
                </tr>
              ))}
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={13}>暂无可预览数据。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function parseWeeklyRows(raw: string) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows: [] as ParsedResult[], errors: [] as string[] };

  const headers = splitRow(lines[0]).map(normalizeHeader);
  const errors: string[] = [];
  const rows = lines.slice(1).flatMap((line, lineIndex) => {
    const cells = splitRow(line);
    const get = (...names: string[]) => {
      const index = headers.findIndex((header) => names.includes(header));
      return index >= 0 ? cells[index]?.trim() || "" : "";
    };
    const playerName = get("姓名", "选手", "名字");
    if (!playerName) {
      errors.push(`第 ${lineIndex + 2} 行缺少姓名。`);
      return [];
    }
    const gender = get("性别") === "女" ? "女" : "男";
    const average = parseScore(get("平均", "成绩", "最终成绩"));
    if (average === null) {
      errors.push(`第 ${lineIndex + 2} 行 ${playerName} 缺少平均成绩。`);
      return [];
    }
    const pbScore = parseScore(get("个人pb", "pb", "个人PB"));
    const personalBest = pbScore ?? average;
    const attempts = [1, 2, 3, 4, 5].map((number) => parseAttempt(get(`t${number}`, `T${number}`, `第${number}次`)));
    return [
      {
        rank: 0,
        playerName,
        gender,
        ageGroup: get("年龄组", "组别"),
        level: get("段位"),
        grade: get("等级"),
        average,
        personalBest,
        pbRefreshed: ["是", "y", "yes", "true", "1"].includes(get("刷新pb", "是否刷新pb", "pb刷新").toLowerCase()),
        attempts
      }
    ];
  });

  rows.sort((a, b) => a.average - b.average);
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });
  return { rows, errors };
}

function splitRow(line: string) {
  if (line.includes("\t")) return line.split("\t");
  return line.split(",");
}

function normalizeHeader(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

function parseScore(value: string) {
  const clean = value.trim().toUpperCase();
  if (!clean || clean === "DNF") return null;
  const timeParts = clean.split(":");
  if (timeParts.length === 2) {
    const minutes = Number(timeParts[0]);
    const seconds = Number(timeParts[1]);
    return Number.isFinite(minutes) && Number.isFinite(seconds) ? minutes * 60 + seconds : null;
  }
  const number = Number(clean);
  return Number.isFinite(number) ? number : null;
}

function parseAttempt(value: string): number | "DNF" {
  const score = parseScore(value);
  return score === null ? "DNF" : score;
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function Field({
  label,
  value,
  onChange,
  full,
  textarea,
  type = "text",
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  full?: boolean;
  textarea?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className={`field ${full ? "full" : ""}`}>
      {label}
      {textarea ? (
        <textarea placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input placeholder={placeholder} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}
