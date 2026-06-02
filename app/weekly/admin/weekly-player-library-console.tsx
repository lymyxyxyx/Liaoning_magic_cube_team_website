"use client";

import { useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import type { WeeklyLibraryGender, WeeklyPlayerLibraryEntry } from "@/lib/weekly-player-library";

type DraftPlayer = WeeklyPlayerLibraryEntry;

const emptyDraft = {
  id: "",
  name: "",
  gender: "" as WeeklyLibraryGender,
  birthDate: "",
  province: "",
  city: "",
  source: "后台新增"
};

export function WeeklyPlayerLibraryConsole({
  initialPlayers,
  variant = "full"
}: {
  initialPlayers: WeeklyPlayerLibraryEntry[];
  variant?: "full" | "side";
}) {
  const [players, setPlayers] = useState<DraftPlayer[]>(initialPlayers);
  const [draft, setDraft] = useState(emptyDraft);
  const [query, setQuery] = useState("");
  const [batchText, setBatchText] = useState("");
  const [status, setStatus] = useState(initialPlayers.length > 0 ? "已读取" : "等待保存");
  const [notice, setNotice] = useState("");

  const visiblePlayers = useMemo(() => {
    const q = query.trim();
    if (!q) return players;
    return players.filter((player) => {
      return [player.name, player.gender, player.birthDate, player.province, player.city, player.source].some((value) => value.includes(q));
    });
  }, [players, query]);

  const completedCount = players.filter((player) => player.gender && player.birthDate && player.province && player.city).length;

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
    setStatus("有未保存修改");
    setNotice("已加入列表，保存后写入选手库。");
  }

  function importBatch() {
    const parsedPlayers = batchText
      .split(/\r?\n/)
      .map(parseBatchLine)
      .filter((player): player is DraftPlayer => Boolean(player?.name))
      .filter((player) => !players.some((current) => current.name === player.name));

    if (parsedPlayers.length === 0) {
      setNotice("没有可导入的新姓名。每行可写：姓名，性别。");
      return;
    }

    setPlayers((current) => [...parsedPlayers, ...current]);
    setBatchText("");
    setStatus("有未保存修改");
    setNotice(`已导入 ${parsedPlayers.length} 名选手，保存后写入选手库。`);
  }

  function updatePlayer(id: string, next: Partial<DraftPlayer>) {
    setPlayers((current) => current.map((player) => (player.id === id ? { ...player, ...next } : player)));
    setStatus("有未保存修改");
  }

  function removePlayer(id: string) {
    if (!window.confirm("确认从周赛选手库删除这名选手？")) return;
    setPlayers((current) => current.filter((player) => player.id !== id));
    setStatus("有未保存修改");
  }

  function savePlayers() {
    setStatus("保存中");
    setNotice("");
    fetch("/api/weekly-admin/player-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players })
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
          <p>独立于历史周赛姓名和 WCA 选手库，只在周赛后台维护。当前基底来自 mofang123 第334周三阶表姓名识别。</p>
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
          <strong>{completedCount}</strong>
          <span>完整资料</span>
        </div>
        <div className="stat">
          <strong>{visiblePlayers.length}</strong>
          <span>当前显示</span>
        </div>
      </div>

      <div className="weekly-library-workbench">
        <div className="admin-card weekly-library-tools">
          <div className="admin-card-heading">
            <div>
              <h2>新增选手</h2>
              <p>{variant === "side" ? "维护可录入成绩的选手名单。" : "生日、省市可以先空着，后续逐行补齐。"}</p>
            </div>
          </div>
          <div className="weekly-library-form">
            <label>
              姓名
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如：韩沐遥" />
            </label>
            <label>
              性别
              <select value={draft.gender} onChange={(event) => setDraft({ ...draft, gender: normalizeGender(event.target.value) })}>
                <option value="">未填</option>
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </label>
            <label>
              出生年月日
              <input type="date" value={draft.birthDate} onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })} />
            </label>
            <label>
              省份
              <input value={draft.province} onChange={(event) => setDraft({ ...draft, province: event.target.value })} placeholder="辽宁" />
            </label>
            <label>
              城市
              <input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} placeholder="沈阳" />
            </label>
            <button className="button primary" type="button" onClick={addPlayer}>
              <Plus size={16} />
              新增
            </button>
          </div>

          <label className="weekly-library-batch">
            批量导入
            <textarea value={batchText} onChange={(event) => setBatchText(event.target.value)} placeholder={"每行一个：姓名，性别\n例：王一帆，男"} />
          </label>
          <div className="weekly-admin-actions">
            <button className="button" type="button" onClick={importBatch}>
              批量加入
            </button>
            <button className="button primary" type="button" onClick={savePlayers}>
              <Save size={16} />
              保存选手库
            </button>
          </div>
          {notice ? <p className="admin-inline-notice">{notice}</p> : null}
        </div>

        <div className="admin-card weekly-library-table-card">
          <div className="admin-card-heading">
            <div>
              <h2>资料编辑</h2>
              <p>直接在表格内修改，最后统一保存。</p>
            </div>
            <input className="weekly-library-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名 / 省市 / 来源" />
          </div>
          <div className="table-scroll">
            <table className="result-table weekly-library-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>性别</th>
                  <th>出生年月日</th>
                  <th>省份</th>
                  <th>城市</th>
                  <th>来源</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visiblePlayers.map((player) => (
                  <tr key={player.id}>
                    <td data-label="姓名">
                      <input value={player.name} onChange={(event) => updatePlayer(player.id, { name: event.target.value })} />
                    </td>
                    <td data-label="性别">
                      <select value={player.gender} onChange={(event) => updatePlayer(player.id, { gender: normalizeGender(event.target.value) })}>
                        <option value="">未填</option>
                        <option value="男">男</option>
                        <option value="女">女</option>
                      </select>
                    </td>
                    <td data-label="出生年月日">
                      <input type="date" value={player.birthDate} onChange={(event) => updatePlayer(player.id, { birthDate: event.target.value })} />
                    </td>
                    <td data-label="省份">
                      <input value={player.province} onChange={(event) => updatePlayer(player.id, { province: event.target.value })} />
                    </td>
                    <td data-label="城市">
                      <input value={player.city} onChange={(event) => updatePlayer(player.id, { city: event.target.value })} />
                    </td>
                    <td data-label="来源">
                      <input value={player.source} onChange={(event) => updatePlayer(player.id, { source: event.target.value })} />
                    </td>
                    <td data-label="操作">
                      <button className="icon-button danger" type="button" onClick={() => removePlayer(player.id)} aria-label={`删除${player.name}`}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function parseBatchLine(line: string): DraftPlayer | null {
  const cells = line
    .split(/[,，\t]/)
    .map((cell) => cell.trim())
    .filter(Boolean);
  const name = cells[0] || "";
  if (!name) return null;
  return {
    id: createLibraryPlayerId(name),
    name,
    gender: normalizeGender(cells[1] || ""),
    birthDate: "",
    province: "",
    city: "",
    source: "批量导入"
  };
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

function normalizeGender(gender: string): WeeklyLibraryGender {
  if (gender === "男" || gender === "女") return gender;
  return "";
}
