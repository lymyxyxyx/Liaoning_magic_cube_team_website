"use client";

import { Plus, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import { coachGenders, coachLevelTypes, type Coach, type CoachGender, type CoachLevelType } from "@/lib/coach-types";

type Props = {
  initialCoaches: Coach[];
};

type CoachDraft = {
  number: string;
  name: string;
  gender: CoachGender;
  province: string;
  city: string;
  levelType: CoachLevelType;
  certifiedYear: string;
};

const emptyDraft: CoachDraft = {
  number: "",
  name: "",
  gender: "男",
  province: "辽宁",
  city: "沈阳",
  levelType: "初级",
  certifiedYear: "2025"
};

export function CoachesClient({ initialCoaches }: Props) {
  const [coaches, setCoaches] = useState(initialCoaches);
  const [draft, setDraft] = useState(emptyDraft);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const sortedCoaches = useMemo(
    () =>
      [...coaches].sort(
        (a, b) =>
          coachLevelTypes.indexOf(a.levelType) - coachLevelTypes.indexOf(b.levelType) ||
          b.certifiedYear - a.certifiedYear ||
          a.province.localeCompare(b.province, "zh-Hans-CN") ||
          a.city.localeCompare(b.city, "zh-Hans-CN") ||
          a.name.localeCompare(b.name, "zh-Hans-CN")
      ),
    [coaches]
  );

  async function addCoach() {
    const name = draft.name.trim();
    if (!name) {
      setNotice("请填写教练员姓名。");
      return;
    }

    const year = Number(draft.certifiedYear);
    if (!Number.isFinite(year) || year < 1900 || year > 2100) {
      setNotice("请填写正确的考取年份。");
      return;
    }

    const nextCoach: Coach = {
      id: createCoachId(),
      ...(draft.number.trim() ? { number: draft.number.trim() } : {}),
      name,
      gender: draft.gender,
      province: draft.province.trim() || "辽宁",
      city: draft.city.trim() || "沈阳",
      levelType: draft.levelType,
      certifiedYear: Math.trunc(year),
      createdAt: new Date().toISOString()
    };
    const nextCoaches = [nextCoach, ...coaches];

    setIsSaving(true);
    setNotice("正在保存...");
    try {
      const response = await fetch("/api/coaches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coaches: nextCoaches })
      });
      if (!response.ok) throw new Error("save");
      const payload = (await response.json()) as { coaches: Coach[] };
      setCoaches(payload.coaches || nextCoaches);
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
          <h2>教练员信息</h2>
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
              编号
              <input value={draft.number} onChange={(event) => setDraft({ ...draft, number: event.target.value })} placeholder="可选" />
            </label>
            <label>
              姓名
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <label>
              性别
              <select value={draft.gender} onChange={(event) => setDraft({ ...draft, gender: event.target.value as CoachGender })}>
                {coachGenders.map((gender) => (
                  <option value={gender} key={gender}>
                    {gender}
                  </option>
                ))}
              </select>
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
              <select value={draft.levelType} onChange={(event) => setDraft({ ...draft, levelType: event.target.value as CoachLevelType })}>
                {coachLevelTypes.map((levelType) => (
                  <option value={levelType} key={levelType}>
                    {levelType}
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
            <button className="button primary" type="button" disabled={isSaving} onClick={addCoach}>
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
              <th>编号</th>
              <th>姓名</th>
              <th>性别</th>
              <th>地区</th>
              <th>级别</th>
              <th>考取年份</th>
            </tr>
          </thead>
          <tbody>
            {sortedCoaches.length === 0 ? (
              <tr>
                <td colSpan={6}>暂无教练员信息，请点击右上角新建。</td>
              </tr>
            ) : (
              sortedCoaches.map((coach) => (
                <tr key={coach.id}>
                  <td>{coach.number || "-"}</td>
                  <td>{coach.name}</td>
                  <td>{coach.gender}</td>
                  <td>
                    {coach.province} · {coach.city}
                  </td>
                  <td>
                    <span className="status">{coach.levelType}</span>
                  </td>
                  <td>{coach.certifiedYear}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function createCoachId() {
  return `coach-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
