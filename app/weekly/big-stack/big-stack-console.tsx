"use client";

import { FormEvent, useMemo, useState } from "react";
import type {
  BigStackEventId,
  BigStackRecord,
  BigStackPublicRecord
} from "@/lib/big-stack";
import type { WeeklyPlayerLibraryEntry } from "@/lib/weekly-player-library";

type BigStackListRecord = BigStackPublicRecord & Partial<BigStackRecord>;

type Draft = {
  name: string;
  solveCount: string;
  playerId: string;
  wcaId: string;
  achievedAt: string;
  note: string;
};

const pageSize = 50;
const emptyDraft: Draft = { name: "", solveCount: "", playerId: "", wcaId: "", achievedAt: "", note: "" };

export function BigStackConsole({
  eventId,
  initialRecords,
  players,
  isAdmin
}: {
  eventId: BigStackEventId;
  initialRecords: BigStackListRecord[];
  players: WeeklyPlayerLibraryEntry[];
  isAdmin: boolean;
}) {
  const [records, setRecords] = useState(initialRecords);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<BigStackRecord | null>(null);
  const [editingNumber, setEditingNumber] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) => [record.name, record.wcaId, record.playerId, record.note, String(record.weeklyNumber || "")].some((value) => value?.toLowerCase().includes(term)));
  }, [query, records]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleRecords = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  async function jsonRequest<T>(url: string, init: RequestInit) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
      const body = await response.json().catch(() => null) as (T & { message?: string }) | null;
      if (!response.ok || !body) {
        if (response.status === 409 || response.status === 428) {
          const latest = await fetch(`/api/big-stack?event=${eventId}`, { cache: "no-store" });
          if (latest.ok) { const refreshed = await latest.json(); setRecords(refreshed.records); }
        }
        throw new Error(body?.message || "操作失败");
      }
      return body;
    } finally {
      setSaving(false);
    }
  }

  function bindDraftPlayer(playerId: string) {
    const player = playersById.get(playerId);
    setDraft((current) => ({ ...current, playerId, name: player?.name || current.name || "", wcaId: player ? player.wcaId || "" : current.wcaId }));
  }

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const body = await jsonRequest<{ record: BigStackRecord }>("/api/big-stack", {
        method: "POST",
        body: JSON.stringify({
          name: draft.name,
          eventId,
          solveCount: Number(draft.solveCount),
          playerId: draft.playerId,
          wcaId: draft.wcaId,
          achievedAt: draft.achievedAt,
          note: draft.note,
          reason: "管理员新增"
        })
      });
      setRecords((current) => rerank([...current, body.record]));
      setDraft(emptyDraft);
      setReason("");
      setMessage(`已新增 ${body.record.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "新增失败");
    }
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    try {
      const body = await jsonRequest<{ record: BigStackRecord }>(`/api/big-stack/${encodeURIComponent(editing.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ ...editing, weeklyNumber: editingNumber.trim() ? Number(editingNumber) : null, playerVersion: players.find(player => player.weeklyNumber === Number(editingNumber))?.identityVersion || editing.playerVersion, reason: reason || "大堆榜直接编辑", expectedVersion: editing.version })
      });
      setRecords((current) => rerank(
        body.record.eventId === eventId
          ? current.map((record) => record.id === editing.id ? body.record : record)
          : current.filter((record) => record.id !== editing.id)
      ));
      setEditing(null);
      setReason("");
      setMessage(`已保存 ${body.record.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function removeRecord(record: BigStackListRecord) {
    const deleteReason = reason.trim() || window.prompt(`请输入删除“${record.name}”的原因`)?.trim() || "";
    if (!deleteReason || !window.confirm(`确认删除“${record.name}”的${record.eventId}大堆 PB？`)) return;
    try {
      await jsonRequest<{ ok: boolean }>(`/api/big-stack/${encodeURIComponent(record.id)}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: deleteReason, expectedVersion: record.version })
      });
      setRecords((current) => rerank(current.filter((item) => item.id !== record.id)));
      setReason("");
      setEditing(null);
      setMessage(`已删除 ${record.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    }
  }

  return <>
    {isAdmin ? <section className="container section big-stack-admin-panel">
      <details className="admin-card big-stack-pb-admin"><summary>新增记录</summary>
        <p>填写姓名和一小时还原数量即可，项目沿用当前榜单。</p>
        <form className="big-stack-pb-create" onSubmit={createRecord}>
          <label>姓名<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>一小时还原数量<input required min="0" max="10000" step="1" type="number" value={draft.solveCount} onChange={(event) => setDraft({ ...draft, solveCount: event.target.value })} /></label>
          <details className="big-stack-edit-extra"><summary>更多信息（选填）</summary>
            <label className="field">关联周赛选手（沿用原编号）<select value={draft.playerId} onChange={(event) => bindDraftPlayer(event.target.value)}><option value="">暂未关联</option>{players.map((player) => <option key={player.id} value={player.id}>{player.weeklyNumber ? `${player.weeklyNumber} · ` : ""}{player.name}{player.wcaId ? ` · ${player.wcaId}` : ""}</option>)}</select></label>
            <label className="field">WCA ID<input readOnly={Boolean(draft.playerId)} maxLength={10} value={draft.wcaId} onChange={(event) => setDraft({ ...draft, wcaId: event.target.value.toUpperCase() })} placeholder="可留空" /></label>
            <label className="field">达成日期<input type="date" value={draft.achievedAt} onChange={(event) => setDraft({ ...draft, achievedAt: event.target.value })} /></label>
            <label className="field">备注<input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
          </details>
          <button className="button primary" disabled={saving}>{saving ? "保存中…" : "新增记录"}</button>
        </form>
      </details>
    </section> : null}

    <section className="container section big-stack-table-section">
      {message ? <p className="admin-inline-notice" role="status">{message}</p> : null}
      <div className="big-stack-pb-toolbar"><label>搜索<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="姓名、WCA ID、周赛编号" /></label><span>共 {filtered.length} 人</span></div>
      <div className="result-table-wrap"><table className="result-table big-stack-results-table"><thead><tr><th>排名</th><th>周赛编号</th><th>姓名</th><th>WCA ID</th><th>性别</th><th>一小时还原数量</th>{isAdmin ? <th>操作</th> : null}</tr></thead><tbody>
        {visibleRecords.map((record) => <tr key={record.id}><td className="score-strong">#{record.rank}</td><td>{record.weeklyNumber || ""}</td><td>{record.name}</td><td>{record.matchedWcaId ?? record.wcaId ?? ""}</td><td>{record.gender || "未知"}</td><td className="score-strong">{record.solveCount}</td>{isAdmin ? <td><button className="button compact" disabled={saving} onClick={() => { setEditing({ ...record, wcaId: record.matchedWcaId || record.wcaId || "" } as BigStackRecord); setEditingNumber(String(record.weeklyNumber || "")); setReason(""); setMessage(""); }}>编辑</button></td> : null}</tr>)}
        {!visibleRecords.length ? <tr><td colSpan={isAdmin ? 7 : 6}>该项目暂未录入大堆成绩。</td></tr> : null}
      </tbody></table></div>
      <div className="big-stack-pb-pagination"><button className="button compact" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>上一页</button><span>第 {safePage} / {pageCount} 页</span><button className="button compact" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>下一页</button></div>
    </section>

    {editing ? <div className="weekly-admin-login-backdrop" role="presentation"><section className="weekly-admin-login-modal weekly-player-editor-modal" role="dialog" aria-modal="true" aria-label="编辑大堆记录"><div className="admin-card-heading"><div><h2>编辑 {editing.name}</h2><p>在此修改后保存即可。周赛编号沿用已有编号，匹配不到可留空。</p></div></div><form className="weekly-player-editor-grid" onSubmit={saveRecord}>
      <label className="field"><span>姓名</span><input required value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
      <label className="field"><span>一小时还原数量</span><input required min="0" max="10000" type="number" value={editing.solveCount} onChange={(event) => setEditing({ ...editing, solveCount: Number(event.target.value) })} /></label>
      <label className="field"><span>周赛编号</span><input type="text" inputMode="numeric" list="big-stack-weekly-numbers" value={editingNumber} placeholder="已有编号，可留空" onChange={(event) => { setEditingNumber(event.target.value); const player = players.find(player => String(player.weeklyNumber) === event.target.value); setEditing({ ...editing, playerId: player?.id, playerVersion: player?.identityVersion, wcaId: player ? player.wcaId || "" : editing.wcaId }); }} /></label>
      <datalist id="big-stack-weekly-numbers">{players.filter(player => player.weeklyNumber).map(player => <option key={player.id} value={player.weeklyNumber}>{player.name}</option>)}</datalist>
      <label className="field"><span>WCA ID</span><input maxLength={10} value={editing.wcaId || ""} placeholder="精确匹配，无匹配可留空" onChange={(event) => setEditing({ ...editing, wcaId: event.target.value.toUpperCase() })} /></label>
      <label className="field"><span>性别</span><select value={editing.genderOverride || ""} onChange={(event) => setEditing({ ...editing, genderOverride: event.target.value })}><option value="">自动匹配（{editing.gender || "未知"}）</option><option value="男">男</option><option value="女">女</option><option value="未知">未知</option></select></label>
      {message ? <p className="admin-inline-notice" role="status">{message}</p> : null}
      <details className="big-stack-edit-extra"><summary>更多信息（选填）</summary>
        <label className="field"><span>达成日期</span><input type="date" value={editing.achievedAt || ""} onChange={(event) => setEditing({ ...editing, achievedAt: event.target.value })} /></label>
        <label className="field"><span>备注</span><input value={editing.note} onChange={(event) => setEditing({ ...editing, note: event.target.value })} /></label>
        <label className="field"><span>修改说明</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="选填" /></label>
        <button className="button compact" type="button" disabled={saving} onClick={()=>removeRecord(editing)}>删除这条记录</button>
      </details>
      <div className="weekly-admin-login-actions"><button className="button" type="button" disabled={saving} onClick={() => setEditing(null)}>取消</button><button className="button primary" disabled={saving}>{saving ? "保存中…" : "保存"}</button></div>
    </form></section></div> : null}

  </>;
}

function rerank(records: BigStackListRecord[]) {
  const sorted = [...records].sort((a, b) => b.solveCount - a.solveCount || a.name.localeCompare(b.name, "zh-Hans-CN"));
  let previousCount: number | null = null;
  let previousRank = 0;
  return sorted.map((record, index) => {
    const rank = previousCount === record.solveCount ? previousRank : index + 1;
    previousCount = record.solveCount;
    previousRank = rank;
    return { ...record, rank };
  });
}
