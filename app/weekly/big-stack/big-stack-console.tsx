"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { BigStackEventId, BigStackRecord } from "@/lib/big-stack";

type MeetOption = { id: string; title: string };

export function BigStackConsole({
  eventId,
  records,
  meets,
  isAdmin
}: {
  eventId: BigStackEventId;
  records: BigStackRecord[];
  meets: MeetOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState({ name: "", solveCount: "", meetId: meets[0]?.id || "" });
  const [editing, setEditing] = useState<BigStackRecord | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function request(url: string, init: RequestInit) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
      const body = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(body?.message || "操作失败");
      router.refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await request("/api/big-stack", {
      method: "POST",
      body: JSON.stringify({ name: draft.name, eventId, solveCount: Number(draft.solveCount), meetId: draft.meetId })
    });
    if (ok) setDraft({ name: "", solveCount: "", meetId: meets[0]?.id || "" });
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const ok = await request(`/api/big-stack/${encodeURIComponent(editing.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: editing.name,
        eventId: editing.eventId,
        solveCount: editing.solveCount,
        meetId: editing.meetId,
        sourceLabel: editing.sourceLabel
      })
    });
    if (ok) setEditing(null);
  }

  async function removeRecord(record: BigStackRecord) {
    if (!window.confirm(`删除 ${record.name} 的这条大堆记录？`)) return;
    await request(`/api/big-stack/${encodeURIComponent(record.id)}`, { method: "DELETE" });
  }

  return <>
    {isAdmin ? <section className="container section big-stack-admin-panel">
      <div className="admin-card">
        <div className="admin-card-heading"><div><h2>录入{eventId === "333" ? "三阶" : "大堆"}成绩</h2><p>一小时内还原数量。新纪录必须选择所属周赛；历史记录可在下方逐条补齐期次和项目。</p></div></div>
        <form className="weekly-entry-controls weekly-entry-controls--compact" onSubmit={createRecord}>
          <label>姓名<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>一小时还原数量<input required min="0" step="1" type="number" value={draft.solveCount} onChange={(event) => setDraft({ ...draft, solveCount: event.target.value })} /></label>
          <label>所属周赛<select required value={draft.meetId} onChange={(event) => setDraft({ ...draft, meetId: event.target.value })}><option value="">请选择</option>{meets.map((meet) => <option key={meet.id} value={meet.id}>{meet.title}</option>)}</select></label>
          <button className="button primary" disabled={saving}>{saving ? "保存中…" : "录入纪录"}</button>
        </form>
        {message ? <p className="admin-inline-notice">{message}</p> : null}
      </div>
    </section> : null}

    <section className="container section big-stack-table-section">
      <div className="result-table-wrap"><table className="result-table"><thead><tr><th>排名</th><th>姓名</th><th>一小时还原数量</th><th>所属周赛</th>{isAdmin ? <th>操作</th> : null}</tr></thead><tbody>
        {records.map((record) => <tr key={record.id}>
          <td className="score-strong">#{record.rank}</td><td>{record.name}</td><td className="score-strong">{record.solveCount}</td>
          <td>{record.meetTitle || record.sourceLabel || "期次待补"}</td>
          {isAdmin ? <td><button className="button compact" onClick={() => setEditing({ ...record })}>编辑</button> <button className="button compact" onClick={() => removeRecord(record)} disabled={saving}>删除</button></td> : null}
        </tr>)}
        {!records.length ? <tr><td colSpan={isAdmin ? 5 : 4}>该项目暂未录入大堆成绩。</td></tr> : null}
      </tbody></table></div>
    </section>

    {editing ? <div className="weekly-admin-login-backdrop" role="presentation"><section className="weekly-admin-login-modal weekly-player-editor-modal" role="dialog" aria-modal="true" aria-label="编辑大堆记录">
      <div className="admin-card-heading"><div><span className="eyebrow">大堆总榜</span><h2>编辑记录</h2><p>历史资料不确定时，可保留“期次待补”说明，避免错误归属。</p></div></div>
      <form className="weekly-player-editor-grid" onSubmit={saveRecord}>
        <label className="field"><span>姓名</span><input required value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
        <label className="field"><span>项目</span><select value={editing.eventId} onChange={(event) => setEditing({ ...editing, eventId: event.target.value as BigStackEventId })}><option value="333">三阶</option><option value="222">二阶</option><option value="pyram">金字塔</option><option value="maple">枫叶</option><option value="mirror">镜面</option></select></label>
        <label className="field"><span>一小时还原数量</span><input required min="0" type="number" value={editing.solveCount} onChange={(event) => setEditing({ ...editing, solveCount: Number(event.target.value) })} /></label>
        <label className="field"><span>所属周赛</span><select value={editing.meetId || ""} onChange={(event) => setEditing({ ...editing, meetId: event.target.value || null })}><option value="">期次待补</option>{meets.map((meet) => <option key={meet.id} value={meet.id}>{meet.title}</option>)}</select></label>
        <label className="field"><span>来源说明</span><input value={editing.sourceLabel} onChange={(event) => setEditing({ ...editing, sourceLabel: event.target.value })} /></label>
        <div className="weekly-admin-login-actions"><button className="button" type="button" onClick={() => setEditing(null)}>取消</button><button className="button primary" disabled={saving}>{saving ? "保存中…" : "保存"}</button></div>
      </form>
    </section></div> : null}
  </>;
}
