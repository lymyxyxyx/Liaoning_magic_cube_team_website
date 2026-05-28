"use client";

import { ArrowDown, ArrowUp, Plus, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  judgeGenders,
  judgeLevelTypes,
  type Judge,
  type JudgeGender,
  type JudgeLevelType
} from "@/lib/judge-types";

type Props = {
  initialJudges: Judge[];
};

type JudgeDraft = {
  number: string;
  name: string;
  gender: JudgeGender;
  province: string;
  city: string;
  levelType: JudgeLevelType;
  trainingLocation: string;
  trainingDate: string;
};

const liaoningCities = ["沈阳", "大连", "鞍山", "抚顺", "本溪", "丹东", "锦州", "营口", "阜新", "辽阳", "盘锦", "铁岭", "朝阳", "葫芦岛"] as const;

const emptyDraft: JudgeDraft = {
  number: "",
  name: "",
  gender: "男",
  province: "辽宁",
  city: "沈阳",
  levelType: "市一级",
  trainingLocation: "",
  trainingDate: ""
};

export function JudgesClient({ initialJudges }: Props) {
  const [judges, setJudges] = useState(initialJudges);
  const [draft, setDraft] = useState(emptyDraft);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Judge | null>(null);

  const sortedJudges = useMemo(
    () =>
      [...judges].sort(
        (a, b) =>
          displayOrderWeight(a) - displayOrderWeight(b) ||
          levelWeight(a) - levelWeight(b) ||
          trainingDateWeight(a.trainingDate) - trainingDateWeight(b.trainingDate) ||
          a.province.localeCompare(b.province, "zh-Hans-CN") ||
          a.city.localeCompare(b.city, "zh-Hans-CN") ||
          judgeOrderWeight(a) - judgeOrderWeight(b) ||
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

    const trainingLocation = draft.trainingLocation.trim();
    if (!trainingLocation) {
      setNotice("请填写考取地点。");
      return;
    }

    const nextJudge: Judge = {
      id: createJudgeId(),
      ...(draft.number.trim() ? { number: draft.number.trim() } : {}),
      name,
      gender: draft.gender,
      province: draft.province.trim() || "辽宁",
      city: draft.city.trim() || "沈阳",
      levelType: draft.levelType,
      displayOrder: Date.now() + Math.random(),
      trainingSessionId: "manual",
      trainingLocation,
      trainingDate: draft.trainingDate.trim(),
      createdAt: new Date().toISOString()
    };
    const nextJudges = [nextJudge, ...judges];

    const savedJudges = await saveJudges(nextJudges, "已保存，刷新页面后仍可查看。");
    if (savedJudges) {
      setDraft(emptyDraft);
      setIsCreating(false);
    }
  }

  async function updateJudgeCity(judgeId: string, city: string) {
    const nextJudges = judges.map((judge) => (judge.id === judgeId ? { ...judge, province: "辽宁", city } : judge));
    await saveJudges(nextJudges, "城市已更新。");
  }

  function startEdit(judge: Judge) {
    setEditingId(judge.id);
    setEditDraft({ ...judge });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  function updateEditDraft(patch: Partial<Judge>) {
    if (!editDraft) return;
    setEditDraft({ ...editDraft, ...patch });
  }

  async function saveEdit() {
    if (!editDraft) return;
    const nextJudges = judges.map((judge) => (judge.id === editDraft.id ? editDraft : judge));
    const saved = await saveJudges(nextJudges, "已更新。");
    if (saved) {
      setEditingId(null);
      setEditDraft(null);
    }
  }

  async function moveJudge(judgeId: string, direction: "up" | "down") {
    const index = sortedJudges.findIndex((judge) => judge.id === judgeId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= sortedJudges.length) return;
    const current = sortedJudges[index];
    const target = sortedJudges[targetIndex];
    const nextJudges = judges.map((judge) => {
      if (judge.id === current.id) return { ...judge, displayOrder: target.displayOrder ?? targetIndex + 1 };
      if (judge.id === target.id) return { ...judge, displayOrder: current.displayOrder ?? index + 1 };
      return judge;
    });
    await saveJudges(nextJudges, "顺序已更新。");
  }

  async function saveJudges(nextJudges: Judge[], successMessage: string) {
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
      const savedJudges = payload.judges || nextJudges;
      setJudges(savedJudges);
      setNotice(successMessage);
      return savedJudges;
    } catch {
      setNotice("保存失败，请稍后重试。");
      return null;
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
      <div className="judges-level-guide">
        <strong>级别说明：</strong>
        {judgeLevelTypes.map((level) => {
          const badge = levelBadge(level);
          return (
            <span className={`judge-level-badge judge-level-badge--${badge.tone}`} key={level}>
              <span>{badge.stars}</span>
              <span>{level}</span>
            </span>
          );
        })}
      </div>

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
              <select value={draft.gender} onChange={(event) => setDraft({ ...draft, gender: event.target.value as JudgeGender })}>
                {judgeGenders.map((gender) => (
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
              <select value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })}>
                {liaoningCities.map((city) => (
                  <option value={city} key={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
            <label>
              级别
              <select value={draft.levelType} onChange={(event) => setDraft({ ...draft, levelType: event.target.value as JudgeLevelType })}>
                {judgeLevelTypes.map((levelType) => (
                  <option value={levelType} key={levelType}>
                    {levelType}
                  </option>
                ))}
              </select>
            </label>
            <label>
              考取地点
              <input
                value={draft.trainingLocation}
                onChange={(event) => setDraft({ ...draft, trainingLocation: event.target.value })}
                placeholder="如：辽宁沈阳"
              />
            </label>
            <label>
              培训日期
              <input
                value={draft.trainingDate}
                onChange={(event) => setDraft({ ...draft, trainingDate: event.target.value })}
                placeholder="如：2025年8月20日至21日"
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
              <th>序号</th>
              <th>编号</th>
              <th>姓名</th>
              <th>性别</th>
              <th>地区</th>
              <th>级别</th>
              <th>考取地点</th>
              <th>培训日期</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedJudges.length === 0 ? (
              <tr>
                <td colSpan={9}>暂无裁判员信息，请点击右上角新建。</td>
              </tr>
            ) : (
              sortedJudges.map((judge, index) => {
                const isEditing = editingId === judge.id;
                return (
                  <tr key={judge.id}>
                    <td data-label="序号">{index + 1}</td>
                    {isEditing && editDraft ? (
                      <>
                        <td data-label="编号">
                          <input value={editDraft.number || ""} onChange={(e) => updateEditDraft({ number: e.target.value })} placeholder="可选" />
                        </td>
                        <td data-label="姓名">
                          <input value={editDraft.name} onChange={(e) => updateEditDraft({ name: e.target.value })} />
                        </td>
                        <td data-label="性别">
                          <select value={editDraft.gender} onChange={(e) => updateEditDraft({ gender: e.target.value as JudgeGender })}>
                            {judgeGenders.map((gender) => (
                              <option value={gender} key={gender}>{gender}</option>
                            ))}
                          </select>
                        </td>
                        <td data-label="地区">
                          <span className="judges-region-editor">
                            辽宁 ·
                            <select value={editDraft.city} onChange={(e) => updateEditDraft({ city: e.target.value })}>
                              {liaoningCities.map((city) => (
                                <option value={city} key={city}>{city}</option>
                              ))}
                            </select>
                          </span>
                        </td>
                        <td data-label="级别">
                          <select value={editDraft.levelType} onChange={(e) => updateEditDraft({ levelType: e.target.value as JudgeLevelType })}>
                            {judgeLevelTypes.map((level) => (
                              <option value={level} key={level}>{level}</option>
                            ))}
                          </select>
                        </td>
                        <td data-label="考取地点">
                          <input value={editDraft.trainingLocation} onChange={(e) => updateEditDraft({ trainingLocation: e.target.value })} />
                        </td>
                        <td data-label="培训日期">
                          <input value={editDraft.trainingDate} onChange={(e) => updateEditDraft({ trainingDate: e.target.value })} />
                        </td>
                        <td data-label="操作">
                          <div className="judges-form-actions">
                            <button className="button primary" type="button" disabled={isSaving} onClick={saveEdit}>
                              保存
                            </button>
                            <button className="button button--ghost" type="button" disabled={isSaving} onClick={cancelEdit}>
                              取消
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td data-label="编号">{judge.number || "-"}</td>
                        <td data-label="姓名">{judge.name}</td>
                        <td data-label="性别">{judge.gender}</td>
                        <td data-label="地区">
                          <span className="judges-region-editor">
                            辽宁 · {judge.city}
                          </span>
                        </td>
                        <td data-label="级别">
                          <span className={`judge-level-badge judge-level-badge--${levelBadge(judge.levelType).tone}`}>
                            <span>{levelBadge(judge.levelType).stars}</span>
                            <span>{judge.levelType}</span>
                          </span>
                        </td>
                        <td data-label="考取地点">{judge.trainingLocation}</td>
                        <td data-label="培训日期">{judge.trainingDate}</td>
                        <td data-label="操作">
                          <button className="button" type="button" onClick={() => startEdit(judge)}>
                            编辑
                          </button>
                          <button className="button" type="button" onClick={() => moveJudge(judge.id, "up")}>
                            <ArrowUp size={14} />
                            上移
                          </button>
                          <button className="button" type="button" onClick={() => moveJudge(judge.id, "down")}>
                            <ArrowDown size={14} />
                            下移
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function levelWeight(judge: Judge) {
  if (judge.levelType === "国家一级") return -1;
  return judgeLevelTypes.indexOf(judge.levelType);
}

function displayOrderWeight(judge: Judge) {
  return typeof judge.displayOrder === "number" ? judge.displayOrder : Number.MAX_SAFE_INTEGER;
}

function levelBadge(level: JudgeLevelType) {
  if (level === "国际级") return { stars: "★★★★★", tone: "intl" };
  if (level === "国家级" || level === "国家一级") return { stars: "★★★★", tone: "national" };
  if (level === "国家二级" || level === "国家三级") return { stars: "★★★", tone: "national-2" };
  if (level === "省一级" || level === "省二级" || level === "省三级") return { stars: "★★", tone: "province" };
  return { stars: "★", tone: "city" };
}

function trainingDateWeight(trainingDate: string) {
  const match = trainingDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const [, year, month, day] = match;
  return Number(`${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`);
}

function judgeOrderWeight(judge: Judge) {
  if (judge.trainingSessionId === "training-shantou-2025" && judge.name === "王猛") return -1;
  return 0;
}

function createJudgeId() {
  return `judge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
