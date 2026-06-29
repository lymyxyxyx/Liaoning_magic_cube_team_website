"use client";

import { GripVertical, Plus, Save, Trash2, X } from "lucide-react";
import { type DragEvent, useMemo, useState } from "react";
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
  const [editPassword, setEditPassword] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Judge | null>(null);
  const [draggedJudgeId, setDraggedJudgeId] = useState<string | null>(null);
  const [dragOverJudgeId, setDragOverJudgeId] = useState<string | null>(null);
  const [dragOverPlacement, setDragOverPlacement] = useState<"before" | "after">("before");

  const sortedJudges = useMemo(
    () =>
      [...judges].sort(
        (a, b) =>
          pinnedJudgeWeight(a) - pinnedJudgeWeight(b) ||
          levelGroupWeight(a) - levelGroupWeight(b) ||
          nationalPrimaryCityWeight(a) - nationalPrimaryCityWeight(b) ||
          levelWeight(a) - levelWeight(b) ||
          displayOrderWeight(a) - displayOrderWeight(b) ||
          trainingDateWeight(a.trainingDate) - trainingDateWeight(b.trainingDate) ||
          a.province.localeCompare(b.province, "zh-Hans-CN") ||
          a.city.localeCompare(b.city, "zh-Hans-CN") ||
          a.name.localeCompare(b.name, "zh-Hans-CN")
      ),
    [judges]
  );

  const nextSerialNumber = useMemo(() => getNextSerialNumber(judges), [judges]);
  const canEdit = editPassword !== null;

  async function enterEditMode() {
    const password = window.prompt("请输入裁判信息编辑口令");
    if (password === null) return;

    try {
      const response = await fetch("/api/judges/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (!response.ok) throw new Error("auth");
      setEditPassword(password);
      setNotice("已进入编辑模式。");
    } catch {
      setEditPassword(null);
      setNotice("无法编辑。");
    }
  }

  function exitEditMode() {
    setEditPassword(null);
    setIsCreating(false);
    cancelEdit();
    setNotice("已退出编辑模式。");
  }

  async function addJudge() {
    if (!canEdit) {
      setNotice("无法编辑。");
      return;
    }

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
      number: (draft.number.trim() || nextSerialNumber).trim(),
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
    if (!canEdit) {
      setNotice("无法编辑。");
      return;
    }

    const nextJudges = judges.map((judge) => (judge.id === judgeId ? { ...judge, province: "辽宁", city } : judge));
    await saveJudges(nextJudges, "城市已更新。");
  }

  function startEdit(judge: Judge) {
    if (!canEdit) {
      setNotice("无法编辑。");
      return;
    }

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
    if (!canEdit) {
      setNotice("无法编辑。");
      return;
    }

    if (!editDraft) return;
    const nextJudges = judges.map((judge) => (judge.id === editDraft.id ? editDraft : judge));
    const saved = await saveJudges(nextJudges, "已更新。");
    if (saved) {
      setEditingId(null);
      setEditDraft(null);
    }
  }

  function startJudgeDrag(event: DragEvent<HTMLElement>, judgeId: string) {
    if (!canEdit || isSaving || editingId) {
      event.preventDefault();
      return;
    }
    setDraggedJudgeId(judgeId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", judgeId);
  }

  function dragOverJudge(event: DragEvent<HTMLTableRowElement>, judgeId: string) {
    const sourceId = draggedJudgeId || event.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === judgeId || isSaving) return;
    const sourceJudge = sortedJudges.find((judge) => judge.id === sourceId);
    const targetJudge = sortedJudges.find((judge) => judge.id === judgeId);
    if (!sourceJudge || !targetJudge || !canReorderTogether(sourceJudge, targetJudge)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rowRect = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY > rowRect.top + rowRect.height / 2 ? "after" : "before";
    setDragOverJudgeId(judgeId);
    setDragOverPlacement(placement);
  }

  function leaveJudgeDrag(judgeId: string) {
    if (dragOverJudgeId === judgeId) setDragOverJudgeId(null);
  }

  function endJudgeDrag() {
    setDraggedJudgeId(null);
    setDragOverJudgeId(null);
    setDragOverPlacement("before");
  }

  async function dropJudge(event: DragEvent<HTMLTableRowElement>, targetJudgeId: string) {
    event.preventDefault();
    const sourceJudgeId = draggedJudgeId || event.dataTransfer.getData("text/plain");
    endJudgeDrag();
    if (!canEdit || !sourceJudgeId || sourceJudgeId === targetJudgeId || isSaving) return;
    const sourceJudge = sortedJudges.find((judge) => judge.id === sourceJudgeId);
    const targetJudge = sortedJudges.find((judge) => judge.id === targetJudgeId);
    if (!sourceJudge || !targetJudge || !canReorderTogether(sourceJudge, targetJudge)) {
      setNotice("当前按级别和城市分组排序，只能在同一分组内调整顺序。");
      return;
    }
    const reorderedJudges = reorderJudges(sortedJudges, sourceJudgeId, targetJudgeId, dragOverPlacement);
    if (!reorderedJudges) return;
    await saveJudgeOrder(reorderedJudges);
  }

  async function saveJudgeOrder(reorderedJudges: Judge[]) {
    if (!canEdit) {
      setNotice("无法编辑。");
      return;
    }

    const displayOrderById = new Map(reorderedJudges.map((judge, orderIndex) => [judge.id, orderIndex + 1]));
    const nextJudges = judges.map((judge) => {
      const displayOrder = displayOrderById.get(judge.id);
      return displayOrder ? { ...judge, displayOrder } : judge;
    });
    await saveJudges(nextJudges, "顺序已更新。");
  }

  async function deleteJudge(judgeId: string) {
    if (!canEdit) {
      setNotice("无法编辑。");
      return;
    }

    const target = judges.find((judge) => judge.id === judgeId);
    if (!target) return;
    const ok = window.confirm(`确认删除裁判员「${target.name}」？此操作不可撤销。`);
    if (!ok) return;
    const nextJudges = judges.filter((judge) => judge.id !== judgeId);
    const saved = await saveJudges(nextJudges, "已删除。");
    if (saved && editingId === judgeId) cancelEdit();
  }

  async function saveJudges(nextJudges: Judge[], successMessage: string) {
    setIsSaving(true);
    setNotice("正在保存...");
    try {
      const response = await fetch("/api/judges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judges: nextJudges, editPassword })
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
        {canEdit ? (
          <div className="judges-toolbar-actions">
            <>
              <button className="button primary" type="button" onClick={() => setIsCreating(true)}>
                <Plus size={16} />
                新建
              </button>
              <button className="button button--ghost" type="button" onClick={exitEditMode}>
                <X size={16} />
                退出编辑
              </button>
            </>
          </div>
        ) : null}
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

      {canEdit && isCreating ? (
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
              <th>姓名</th>
              <th>性别</th>
              <th>地区</th>
              <th>级别</th>
              <th>考取地点</th>
              <th>培训日期</th>
              {canEdit ? <th>操作</th> : null}
            </tr>
          </thead>
          <tbody>
            {sortedJudges.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 8 : 7}>暂无裁判员信息{canEdit ? "，请点击右上角新建。" : "。"}</td>
              </tr>
            ) : (
              sortedJudges.map((judge, index) => {
                const isEditing = editingId === judge.id;
                const rowClassName = [
                  draggedJudgeId === judge.id ? "is-dragging" : "",
                  dragOverJudgeId === judge.id ? "is-drag-over" : "",
                  dragOverJudgeId === judge.id ? `is-drag-over-${dragOverPlacement}` : ""
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <tr
                    className={rowClassName || undefined}
                    key={judge.id}
                    onDragOver={(event) => dragOverJudge(event, judge.id)}
                    onDragLeave={() => leaveJudgeDrag(judge.id)}
                    onDrop={(event) => dropJudge(event, judge.id)}
                    onDragEnd={endJudgeDrag}
                  >
                    <td data-label="序号">
                      <span className="judge-order-cell">
                        {canEdit ? (
                          <span
                            aria-label={`拖动${judge.name}调整顺序`}
                            className="judge-drag-handle"
                            draggable={!isEditing && !isSaving}
                            role="button"
                            tabIndex={0}
                            title="拖动排序"
                            onDragStart={(event) => startJudgeDrag(event, judge.id)}
                          >
                            <GripVertical size={15} />
                          </span>
                        ) : null}
                        <span>{index + 1}</span>
                      </span>
                    </td>
                    {isEditing && editDraft ? (
                      <>
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
                        {canEdit ? (
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
                        ) : null}
                      </>
                    ) : (
                      <>
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
                        {canEdit ? (
                          <td data-label="操作">
                          <button className="button" type="button" onClick={() => startEdit(judge)}>
                            编辑
                          </button>
                          <button className="button button--danger" type="button" disabled={isSaving} onClick={() => deleteJudge(judge.id)}>
                            <Trash2 size={14} />
                            删除
                          </button>
                          </td>
                        ) : null}
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

function getNextSerialNumber(judges: Judge[]) {
  const existing = new Set(judges.map((judge) => String(judge.number || "").trim()).filter(Boolean));
  for (let index = 1; index < 10000; index += 1) {
    const candidate = String(index);
    if (!existing.has(candidate)) return candidate;
  }
  return String(Date.now());
}

function levelGroupWeight(judge: Judge) {
  if (judge.levelType === "国家一级") return 0;
  if (judge.levelType.startsWith("市")) return 2;
  return 1;
}

function pinnedJudgeWeight(judge: Judge) {
  if (judge.name === "王猛") return 0;
  if (judge.name === "李洋") return 1;
  return 2;
}

function nationalPrimaryCityWeight(judge: Judge) {
  if (judge.levelType !== "国家一级") return 0;
  const cityIndex = liaoningCities.findIndex((city) => city === judge.city);
  return cityIndex >= 0 ? cityIndex : Number.MAX_SAFE_INTEGER;
}

function levelWeight(judge: Judge) {
  return judgeLevelTypes.indexOf(judge.levelType);
}

function displayOrderWeight(judge: Judge) {
  return typeof judge.displayOrder === "number" ? judge.displayOrder : Number.MAX_SAFE_INTEGER;
}

function canReorderTogether(a: Judge, b: Judge) {
  return reorderBucket(a) === reorderBucket(b);
}

function reorderBucket(judge: Judge) {
  return [pinnedJudgeWeight(judge), levelGroupWeight(judge), nationalPrimaryCityWeight(judge), levelWeight(judge)].join(":");
}

function reorderJudges(judges: Judge[], sourceJudgeId: string, targetJudgeId: string, placement: "before" | "after") {
  const sourceIndex = judges.findIndex((judge) => judge.id === sourceJudgeId);
  const targetIndex = judges.findIndex((judge) => judge.id === targetJudgeId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return null;
  const nextJudges = [...judges];
  const [sourceJudge] = nextJudges.splice(sourceIndex, 1);
  const targetIndexAfterRemoval = nextJudges.findIndex((judge) => judge.id === targetJudgeId);
  const insertIndex = placement === "after" ? targetIndexAfterRemoval + 1 : targetIndexAfterRemoval;
  nextJudges.splice(insertIndex, 0, sourceJudge);
  return nextJudges;
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

function createJudgeId() {
  return `judge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
