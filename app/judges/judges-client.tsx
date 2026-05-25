"use client";

import { Plus, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import { judgeLevels, type Judge, type JudgeLevel } from "@/lib/judge-types";

type Props = {
  initialJudges: Judge[];
};

type JudgeDraft = {
  name: string;
  province: string;
  city: string;
  level: JudgeLevel;
  certifiedYear: string;
};

const emptyDraft: JudgeDraft = {
  name: "",
  province: "辽宁",
  city: "沈阳",
  level: "市级",
  certifiedYear: "2025"
};

export function JudgesClient({ initialJudges }: Props) {
  const [judges, setJudges] = useState(initialJudges);
  const [draft, setDraft] = useState(emptyDraft);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const sortedJudges = useMemo(
    () =>
      [...judges].sort(
        (a, b) =>
          levelWeight(a.level) - levelWeight(b.level) ||
          b.certifiedYear - a.certifiedYear ||
          a.province.localeCompare(b.province, "zh-Hans-CN") ||
          a.city.localeCompare(b.city, "zh-Hans-CN") ||
          a.name.localeCompare(b.name, "zh-Hans-CN")
      ),
    [judges]
  );

  async function addJudge() {
    const name = draft.name.trim();
    if (!name) {
      setNotice("请填写裁判员姓名。");
      return;
    }

    const year = Number(draft.certifiedYear);
    if (!Number.isFinite(year) || year < 1900 || year > 2100) {
      setNotice("请填写正确的考取年份。");
      return;
    }

    const nextJudge: Judge = {
      id: createJudgeId(),
      name,
      province: draft.province.trim() || "辽宁",
      city: draft.city.trim() || "沈阳",
      level: draft.level,
      certifiedYear: Math.trunc(year),
      createdAt: new Date().toISOString()
    };
    const nextJudges = [nextJudge, ...judges];

    setIsSaving(true);
    setNotice("正在保存...");
    try {
      const response = await fetch("/api/judges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judges: nextJudges })
      });
      if (!response.ok) throw new Error("save");
      const payload = (await response.json()) as { judges: Judge[] };
      setJudges(payload.judges || nextJudges);
      setDraft(emptyDraft);
      setIsCreating(false);
      setNotice("已保存，刷新页面后仍可查看。");
    } catch {
      setNotice("保存失败，请稍后重试。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="container section judges-workspace">
      <div className="judges-toolbar">
        <div>
          <span className="eyebrow">在线表格</span>
          <h2>裁判员信息</h2>
        </div>
        <button className="button primary" type="button" onClick={() => setIsCreating(true)}>
          <Plus size={16} />
          新建
        </button>
      </div>

      {notice ? <p className="judges-notice">{notice}</p> : null}

      {isCreating ? (
        <div className="judges-create-card">
          <div className="judges-form-grid">
            <label>
              姓名
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <label>
              省份
              <input value={draft.province} onChange={(event) => setDraft({ ...draft, province: event.target.value })} />
            </label>
            <label>
              城市
              <input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} />
            </label>
            <label>
              级别
              <select value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value as JudgeLevel })}>
                {judgeLevels.map((level) => (
                  <option value={level} key={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <label>
              考取年份
              <input
                inputMode="numeric"
                value={draft.certifiedYear}
                onChange={(event) => setDraft({ ...draft, certifiedYear: event.target.value })}
              />
            </label>
          </div>
          <div className="judges-form-actions">
            <button className="button primary" type="button" disabled={isSaving} onClick={addJudge}>
              <Save size={16} />
              {isSaving ? "保存中" : "保存"}
            </button>
            <button className="button button--ghost" type="button" disabled={isSaving} onClick={() => setIsCreating(false)}>
              <X size={16} />
              取消
            </button>
          </div>
        </div>
      ) : null}

      <div className="result-table-wrap judges-table-wrap">
        <table className="result-table judges-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>地区</th>
              <th>级别</th>
              <th>考取年份</th>
            </tr>
          </thead>
          <tbody>
            {sortedJudges.length === 0 ? (
              <tr>
                <td colSpan={4}>暂无裁判员信息，请点击右上角新建。</td>
              </tr>
            ) : (
              sortedJudges.map((judge) => (
                <tr key={judge.id}>
                  <td>{judge.name}</td>
                  <td>
                    {judge.province} · {judge.city}
                  </td>
                  <td>
                    <span className="status">{judge.level}</span>
                  </td>
                  <td>{judge.certifiedYear}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function levelWeight(level: JudgeLevel) {
  return judgeLevels.indexOf(level);
}

function createJudgeId() {
  return `judge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
