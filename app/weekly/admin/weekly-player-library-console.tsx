"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { getWeeklyRankingAgeGroup, weeklyRankingAgeGroups } from "@/lib/weekly-age-groups";
import type { WeeklyLibraryGender, WeeklyPersonalBests, WeeklyPlayerLibraryEntry } from "@/lib/weekly-player-library";

type DraftPlayer = WeeklyPlayerLibraryEntry;

const defaultProvince = "辽宁";
const defaultCity = "沈阳";
const chinaProvinces = [
  "北京",
  "天津",
  "河北",
  "山西",
  "内蒙古",
  "辽宁",
  "吉林",
  "黑龙江",
  "上海",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "山东",
  "河南",
  "湖北",
  "湖南",
  "广东",
  "广西",
  "海南",
  "重庆",
  "四川",
  "贵州",
  "云南",
  "西藏",
  "陕西",
  "甘肃",
  "青海",
  "宁夏",
  "新疆",
  "香港",
  "澳门",
  "台湾"
];
const liaoningCities = ["沈阳", "大连", "鞍山", "抚顺", "本溪", "丹东", "锦州", "营口", "阜新", "辽阳", "盘锦", "铁岭", "朝阳", "葫芦岛"];

const emptyDraft = {
  id: "",
  name: "",
  gender: "" as WeeklyLibraryGender,
  birthDate: "",
  ageGroup: "",
  ageGroupIsFuzzy: false,
  province: defaultProvince,
  city: defaultCity,
  source: "后台新增"
};

export function WeeklyPlayerLibraryConsole({
  initialPlayers,
  variant = "full",
  apiPath = "/api/admin/weekly-player-library"
}: {
  initialPlayers: WeeklyPlayerLibraryEntry[];
  variant?: "full" | "side";
  apiPath?: string;
}) {
  const [players, setPlayers] = useState<DraftPlayer[]>(initialPlayers);
  const [draft, setDraft] = useState(emptyDraft);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(initialPlayers.length > 0 ? "已读取" : "等待保存");
  const [notice, setNotice] = useState("");
  const [isCreatingPlayer, setIsCreatingPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<DraftPlayer | null>(null);

  const visiblePlayers = useMemo(() => {
    const q = query.trim();
    if (!q) return players;
    return players.filter((player) => {
      return [player.name, player.wcaId, player.gender, getDisplayAgeGroup(player), player.birthDate, player.province, player.city].some((value) =>
        (value || "").includes(q)
      );
    });
  }, [players, query]);

  const matchedCount = players.filter((player) => player.wcaId || player.city).length;

  function addPlayer() {
    const name = draft.name.trim();
    if (!name) {
      setNotice("请先填写姓名。");
      return;
    }
    if (players.some((player) => player.name === name)) {
      setNotice("选手库里已经有这个姓名。");
      return;
    }
    setPlayers((current) => [{ ...draft, id: createLibraryPlayerId(name), name }, ...current]);
    setDraft(emptyDraft);
    setIsCreatingPlayer(false);
    setStatus("有未保存修改");
    setNotice("已加入列表，保存后写入选手库。");
  }

  function openCreator() {
    setDraft(emptyDraft);
    setNotice("");
    setIsCreatingPlayer(true);
  }

  function openEditor(player: DraftPlayer) {
    setEditingPlayer({
      ...player,
      province: player.province || defaultProvince,
      city: player.city || defaultCity
    });
  }

  function updateEditingPlayer(next: Partial<DraftPlayer>) {
    setEditingPlayer((current) => (current ? { ...current, ...next } : current));
  }

  function saveEditingPlayer() {
    if (!editingPlayer) return;
    const name = editingPlayer.name.trim();
    if (!name) {
      setNotice("姓名不能为空。");
      return;
    }
    const nextPlayers = players.map((player) => (player.id === editingPlayer.id ? { ...editingPlayer, name } : player));
    setPlayers(nextPlayers);
    setEditingPlayer(null);
    savePlayers(nextPlayers);
  }

  function removePlayer(id: string) {
    if (!window.confirm("确认从周赛选手库删除这名选手？")) return;
    setPlayers((current) => current.filter((player) => player.id !== id));
    setStatus("有未保存修改");
  }

  function savePlayers(nextPlayers = players) {
    setStatus("保存中");
    setNotice("");
    fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players: nextPlayers })
    })
      .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
      .then(({ ok, payload }) => {
        if (!ok) throw new Error(payload.message || "保存失败");
        setPlayers(payload.players || []);
        setStatus("已保存");
        setNotice("周赛选手库已保存。");
      })
      .catch((error) => {
        setStatus("保存失败");
        setNotice(error instanceof Error ? error.message : "保存失败，请稍后重试。");
      });
  }

  return (
    <section className={`${variant === "side" ? "" : "container section"} weekly-library-shell weekly-library-shell--${variant}`.trim()} id="weekly-player-library">
      <div className="admin-workspace-heading">
        <div>
          <h1>周赛选手库</h1>
          <p>整合 WCA 辽宁选手、既有周赛基底与个人 PB 表；同名选手会合并为同一条资料。</p>
        </div>
        <span className="status">{status}</span>
      </div>

      <div className="stat-band admin-profile-stats">
        <div className="stat">
          <strong>{players.length}</strong>
          <span>库内选手</span>
        </div>
        <div className="stat">
          <strong>{players.filter((player) => player.gender).length}</strong>
          <span>已填性别</span>
        </div>
        <div className="stat">
          <strong>{matchedCount}</strong>
          <span>匹配资料</span>
        </div>
        <div className="stat">
          <strong>{players.filter((player) => Object.keys(player.personalBests || {}).length > 0).length}</strong>
          <span>已录个人 PB</span>
        </div>
        <div className="stat">
          <strong>{players.filter((player) => getDisplayAgeGroup(player)).length}</strong>
          <span>已填组别</span>
        </div>
        <div className="stat">
          <strong>{visiblePlayers.length}</strong>
          <span>当前显示</span>
        </div>
      </div>

      <div className="weekly-library-workbench">
        <div className="admin-card weekly-library-table-card">
          <div className="admin-card-heading">
            <div>
              <h2>资料编辑</h2>
              <p>WCA ID、城市和个人 PB 会在导入后自动合并；匹配不到的姓名会作为新选手保留。</p>
            </div>
            <div className="weekly-library-toolbar">
              <input className="weekly-library-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名 / 省市" />
              <button className="button" type="button" onClick={openCreator}>
                <Plus size={15} />
                新建
              </button>
              <button className="button primary" type="button" onClick={() => savePlayers()}>
                <Save size={15} />
                保存
              </button>
            </div>
          </div>
          {notice ? <p className="admin-inline-notice weekly-library-notice">{notice}</p> : null}
          <div className="table-scroll">
            <table className="result-table weekly-library-table">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>姓名</th>
                  <th>WCA ID</th>
                  <th>性别</th>
                  <th>出生日期</th>
                  <th>组别</th>
                  <th>省份</th>
                  <th>城市</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visiblePlayers.map((player, index) => (
                  <tr key={player.id}>
                    <td data-label="序号" className="weekly-library-index">
                      {index + 1}
                    </td>
                    <td data-label="姓名">
                      <strong>{player.name}</strong>
                    </td>
                    <td data-label="WCA ID">{player.wcaId || ""}</td>
                    <td data-label="性别">{player.gender || ""}</td>
                    <td data-label="出生日期">{player.birthDate || ""}</td>
                    <td data-label="组别">
                      {getDisplayAgeGroup(player)}
                      {isFuzzyAgeGroup(player) ? <span className="weekly-library-fuzzy">模糊</span> : null}
                    </td>
                    <td data-label="省份">{player.province || ""}</td>
                    <td data-label="城市">{player.city || ""}</td>
                    <td data-label="操作">
                      <span className="weekly-library-row-actions">
                        <button className="icon-button" type="button" onClick={() => openEditor(player)} aria-label={`编辑${player.name}`}>
                          <Pencil size={15} />
                        </button>
                        <button className="icon-button danger" type="button" onClick={() => removePlayer(player.id)} aria-label={`删除${player.name}`}>
                          <Trash2 size={15} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {isCreatingPlayer ? (
        <div className="weekly-library-dialog-backdrop" role="presentation">
          <div className="weekly-library-dialog" role="dialog" aria-modal="true" aria-label="新建选手">
            <div className="admin-card-heading">
              <div>
                <h2>新建选手</h2>
                <p>默认辽宁沈阳，生日可后续补齐。</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setIsCreatingPlayer(false)} aria-label="关闭新建">
                <X size={17} />
              </button>
            </div>
            <PlayerFields
              player={draft}
              onChange={(next) => setDraft((current) => ({ ...current, ...next }))}
            />
            <div className="weekly-admin-actions">
              <button className="button" type="button" onClick={() => setIsCreatingPlayer(false)}>
                取消
              </button>
              <button className="button primary" type="button" onClick={addPlayer}>
                <Plus size={16} />
                加入列表
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {editingPlayer ? (
        <div className="weekly-library-dialog-backdrop" role="presentation">
          <div className="weekly-library-dialog" role="dialog" aria-modal="true" aria-label="编辑选手">
            <div className="admin-card-heading">
              <div>
                <h2>编辑选手</h2>
                <p>{editingPlayer.wcaId ? `匹配 WCA：${editingPlayer.wcaId}` : "未匹配 WCA ID"}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setEditingPlayer(null)} aria-label="关闭编辑">
                <X size={17} />
              </button>
            </div>
            <PlayerFields player={editingPlayer} onChange={updateEditingPlayer} />
            <div className="weekly-admin-actions">
              <button className="button" type="button" onClick={() => setEditingPlayer(null)}>
                取消
              </button>
              <button className="button primary" type="button" onClick={saveEditingPlayer}>
                <Save size={16} />
                保存修改
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PlayerFields({
  player,
  onChange
}: {
  player: DraftPlayer;
  onChange: (next: Partial<DraftPlayer>) => void;
}) {
  return (
    <div className="weekly-library-form weekly-library-edit-form">
      <label>
        姓名
        <input value={player.name} onChange={(event) => onChange({ name: event.target.value })} placeholder="例如：韩沐遥" />
      </label>
      <label>
        性别
        <select value={player.gender} onChange={(event) => onChange({ gender: normalizeGender(event.target.value) })}>
          <option value="">未填</option>
          <option value="男">男</option>
          <option value="女">女</option>
        </select>
      </label>
      <label>
        出生年月日
        <input type="date" value={player.birthDate} onChange={(event) => onChange(updateBirthDate(player, event.target.value))} />
      </label>
      <label>
        组别
        <select value={getEditableAgeGroup(player)} disabled={Boolean(player.birthDate)} onChange={(event) => onChange(updateManualAgeGroup(player, event.target.value))}>
          <option value="">未填</option>
          {weeklyRankingAgeGroups.filter((group) => group !== "待补").map((group) => (
            <option value={group} key={group}>
              {group}
            </option>
          ))}
        </select>
      </label>
      <label>
        省份
        <select
          value={player.province || defaultProvince}
          onChange={(event) => onChange({ province: event.target.value, city: event.target.value === "辽宁" ? player.city || defaultCity : player.city })}
        >
          {chinaProvinces.map((province) => (
            <option value={province} key={province}>
              {province}
            </option>
          ))}
        </select>
      </label>
      <label>
        城市
        <select value={player.city || defaultCity} onChange={(event) => onChange({ city: event.target.value })}>
          {liaoningCities.map((city) => (
            <option value={city} key={city}>
              {city}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="weekly-library-pb-fields">
        <legend>个人 PB</legend>
        <p>单位：秒。留空表示暂无记录。</p>
        <div className="weekly-library-pb-grid">
          {personalBestFields.map((field) => (
            <label key={field.id}>
              {field.label} PB
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={formatPersonalBestInput(player.personalBests?.[field.id])}
                onChange={(event) => onChange(updatePersonalBest(player, field.id, event.target.value))}
              />
            </label>
          ))}
        </div>
        <div className="weekly-library-pb-grid">
          {personalBestFields.map((field) => (
            <label key={`${field.id}-average`}>
              {field.label} 平均 PB
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={formatPersonalBestInput(player.personalBestAverages?.[field.id])}
                onChange={(event) => onChange(updatePersonalBest(player, field.id, event.target.value, true))}
              />
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function createLibraryPlayerId(name: string) {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "") || Date.now().toString(36);
  return `weekly-library-${base}-${Math.random().toString(36).slice(2, 8)}`;
}

const personalBestFields = [
  { id: "333", label: "三阶" },
  { id: "222", label: "二阶" },
  { id: "pyram", label: "金字塔" },
  { id: "mirror", label: "镜面" },
  { id: "maple", label: "枫叶" },
  { id: "skewb", label: "斜转" },
  { id: "allAround", label: "全能" }
] as const;

function formatPersonalBestInput(value: number | undefined) {
  return typeof value === "number" && value > 0 ? String(value) : "";
}

function updatePersonalBest(player: DraftPlayer, key: keyof WeeklyPersonalBests, rawValue: string, average = false): DraftPlayer {
  const value = rawValue.trim() ? Number(rawValue) : NaN;
  const next = { ...(average ? player.personalBestAverages : player.personalBests) };
  if (Number.isFinite(value) && value > 0) next[key] = value;
  else delete next[key];
  return average ? { ...player, personalBestAverages: next } : { ...player, personalBests: next };
}

function normalizeGender(gender: string): WeeklyLibraryGender {
  if (gender === "男" || gender === "女") return gender;
  return "";
}

function getDisplayAgeGroup(player: Pick<DraftPlayer, "birthDate" | "ageGroup">) {
  return player.birthDate || player.ageGroup ? getWeeklyRankingAgeGroup(player.birthDate, player.ageGroup) : "";
}

function getEditableAgeGroup(player: Pick<DraftPlayer, "birthDate" | "ageGroup">) {
  return player.birthDate ? getWeeklyRankingAgeGroup(player.birthDate, player.ageGroup) : player.ageGroup || "";
}

function isFuzzyAgeGroup(player: Pick<DraftPlayer, "birthDate" | "ageGroup" | "ageGroupIsFuzzy">) {
  return !player.birthDate && Boolean(player.ageGroup) && Boolean(player.ageGroupIsFuzzy);
}

function updateBirthDate<T extends Pick<DraftPlayer, "birthDate" | "ageGroup" | "ageGroupIsFuzzy">>(player: T, birthDate: string) {
  return {
    ...player,
    birthDate,
    ageGroup: birthDate ? "" : player.ageGroup,
    ageGroupIsFuzzy: birthDate ? false : player.ageGroupIsFuzzy
  };
}

function updateManualAgeGroup<T extends Pick<DraftPlayer, "birthDate" | "ageGroup" | "ageGroupIsFuzzy">>(player: T, value: string) {
  const ageGroup = normalizeAgeGroup(value);
  return {
    ...player,
    ageGroup: player.birthDate ? "" : ageGroup,
    ageGroupIsFuzzy: !player.birthDate && Boolean(ageGroup)
  };
}

function normalizeAgeGroup(value: string) {
  const group = value.trim().toUpperCase();
  return weeklyRankingAgeGroups.includes(group as (typeof weeklyRankingAgeGroups)[number]) && group !== "待补" ? group : "";
}
