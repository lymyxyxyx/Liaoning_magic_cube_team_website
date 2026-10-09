"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import type {
  BigStackEventId,
  BigStackImportMode,
  BigStackImportPreview,
  BigStackRecord,
  BigStackPublicRecord,
  BigStackRevision
} from "@/lib/big-stack";
import type { WeeklyPlayerLibraryEntry } from "@/lib/weekly-player-library";

type BigStackListRecord = BigStackPublicRecord & Partial<BigStackRecord>;

type MeetOption = { id: string; title: string };
type Draft = {
  name: string;
  solveCount: string;
  playerId: string;
  wcaId: string;
  achievedAt: string;
  meetId: string;
  note: string;
};

const pageSize = 50;
const emptyDraft: Draft = { name: "", solveCount: "", playerId: "", wcaId: "", achievedAt: "", meetId: "", note: "" };

export function BigStackConsole({
  eventId,
  initialRecords,
  meets,
  players,
  isAdmin
}: {
  eventId: BigStackEventId;
  initialRecords: BigStackListRecord[];
  meets: MeetOption[];
  players: WeeklyPlayerLibraryEntry[];
  isAdmin: boolean;
}) {
  const [records, setRecords] = useState(initialRecords);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<BigStackRecord | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<BigStackImportMode>("merge");
  const [preview, setPreview] = useState<BigStackImportPreview | null>(null);
  const [revisions, setRevisions] = useState<BigStackRevision[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) => [record.name, record.wcaId, record.playerId, record.note, record.playerId ? String(playersById.get(record.playerId)?.weeklyNumber || "") : ""].some((value) => value?.toLowerCase().includes(term)));
  }, [query, records, playersById]);
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
          meetId: draft.meetId || null,
          note: draft.note,
          reason: reason || "管理员新增"
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
        body: JSON.stringify({ ...editing, reason, expectedVersion: editing.version })
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
      setMessage(`已删除 ${record.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    }
  }

  async function runImport(action: "preview" | "commit") {
    if (!file) return setMessage("请先选择 .xlsx 文件");
    if (action === "commit" && (!preview || preview.eventId !== eventId || preview.mode !== mode || preview.errors.length)) return setMessage("请重新预览当前项目和文件");
    if (action === "commit" && mode === "baseline" && !window.confirm(`这会删除当前${eventId}项目全部记录，并以 Excel 为唯一基线。确认继续？`)) return;
    setSaving(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("eventId", eventId);
      formData.set("mode", mode);
      formData.set("action", action);
      if (action === "commit" && preview) formData.set("previewToken", preview.token);
      if (action === "commit" && mode === "baseline") formData.set("confirmBaseline", "true");
      const response = await fetch("/api/big-stack/import", { method: "POST", body: formData });
      const body = await response.json().catch(() => null) as { preview?: BigStackImportPreview; records?: BigStackRecord[]; message?: string } | null;
      if (!response.ok) { if (response.status === 409) setPreview(null); throw new Error(body?.message || "导入失败"); }
      if (action === "preview" && body?.preview) {
        setPreview(body.preview);
        setMessage("预览完成，请核对统计和异常项后再提交");
      } else if (body?.records) {
        setRecords(body.records);
        setPreview(null);
        setPage(1);
        setMessage(`导入完成，当前项目共 ${body.records.length} 条长期 PB`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入失败");
    } finally {
      setSaving(false);
    }
  }

  async function loadHistory() {
    setHistoryOpen(true);
    try {
      const response = await fetch("/api/big-stack?history=1&limit=50");
      const body = await response.json().catch(() => null) as { revisions?: BigStackRevision[]; message?: string } | null;
      if (!response.ok) throw new Error(body?.message || "读取历史失败");
      setRevisions(body?.revisions || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取历史失败");
    }
  }

  return <>
    {isAdmin ? <section className="container section big-stack-admin-panel">
      <div className="admin-card big-stack-pb-admin">
        <div className="admin-card-heading"><div><h2>长期 PB 管理</h2><p>大堆总榜不属于某一次周赛。首次全量替换，日常使用 PB 合并；较低成绩不会覆盖。</p></div><button className="button" type="button" onClick={loadHistory}>最近修改</button></div>
        {message ? <p className="admin-inline-notice">{message}</p> : null}

        <div className="big-stack-pb-import">
          <label>导入模式<select disabled={saving} value={mode} onChange={(event) => { setMode(event.target.value as BigStackImportMode); setPreview(null); }}><option value="merge">PB 合并（日常）</option><option value="baseline">全量基线替换</option></select></label>
          <label>Excel 文件<input disabled={saving} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); }} /></label>
          <div className="weekly-admin-login-actions"><button className="button" type="button" disabled={saving || !file} onClick={() => runImport("preview")}>预览</button><button className="button primary" type="button" disabled={saving || !file || !preview || preview.errors.length > 0} onClick={() => runImport("commit")}>确认导入</button></div>
        </div>
        {preview ? <ImportPreview preview={preview} /> : null}

        <form className="big-stack-pb-create" onSubmit={createRecord}>
          <label>姓名<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>一小时还原数量<input required min="0" step="1" type="number" value={draft.solveCount} onChange={(event) => setDraft({ ...draft, solveCount: event.target.value })} /></label>
          <label>关联周赛选手（沿用原编号）<select value={draft.playerId} onChange={(event) => bindDraftPlayer(event.target.value)}><option value="">暂未关联</option>{players.map((player) => <option key={player.id} value={player.id}>{player.weeklyNumber ? `${player.weeklyNumber} · ` : ""}{player.name}{player.wcaId ? ` · ${player.wcaId}` : ""}</option>)}</select></label>
          <label>WCA ID<input readOnly={Boolean(draft.playerId)} value={draft.wcaId} onChange={(event) => setDraft({ ...draft, wcaId: event.target.value.toUpperCase() })} placeholder="可选" /></label>
          <label>达成日期<input type="date" value={draft.achievedAt} onChange={(event) => setDraft({ ...draft, achievedAt: event.target.value })} /></label>
          <label>来源周赛<select value={draft.meetId} onChange={(event) => setDraft({ ...draft, meetId: event.target.value })}><option value="">非特定周赛 / 待补</option>{meets.map((meet) => <option key={meet.id} value={meet.id}>{meet.title}</option>)}</select></label>
          <label>备注<input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
          <label>修改原因<input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="纠错、改身份或删除时必填" /></label>
          <button className="button primary" disabled={saving}>{saving ? "保存中…" : "新增记录"}</button>
        </form>
        <p>大堆与普通周赛共用选手编号和 WCA 绑定。<Link href="/admin/weekly/players">管理共用编号、匹配辽宁魔友库 WCA ID</Link>；未关联的历史记录需先核对并选择已有选手。</p>

        {historyOpen ? <details className="big-stack-pb-history" open><summary>最近 50 条修改历史</summary>{revisions.length === 0 ? <p>暂无修改历史。</p> : revisions.map((revision) => <div key={revision.id}><strong>{revision.after?.name || revision.before?.name || revision.recordId}</strong><span>{revision.action} · {revision.before?.solveCount ?? "—"} → {revision.after?.solveCount ?? "—"}</span><span>{revision.reason}{revision.pointsAwarded ? " · 刷新 PB" : ""}</span><time>{new Date(revision.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</time></div>)}</details> : null}
      </div>
    </section> : null}

    <section className="container section big-stack-table-section">
      <div className="big-stack-pb-toolbar"><label>搜索<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={isAdmin ? "姓名、WCA ID、周赛编号" : "姓名或 WCA ID"} /></label><span>共 {filtered.length} 人</span></div>
      <div className="result-table-wrap"><table className="result-table"><thead><tr><th>排名</th>{isAdmin ? <th>周赛编号</th> : null}<th>姓名</th><th>一小时还原数量</th><th>来源</th>{isAdmin ? <th>操作</th> : null}</tr></thead><tbody>
        {visibleRecords.map((record) => <tr key={record.id}><td className="score-strong">#{record.rank}</td>{isAdmin ? <td>{record.playerId ? playersById.get(record.playerId)?.weeklyNumber || "未关联" : "未关联"}</td> : null}<td>{record.name}{record.wcaId ? <small className="big-stack-pb-id">{record.wcaId}</small> : null}</td><td className="score-strong">{record.solveCount}</td><td>{record.meetTitle || record.sourceLabel || "长期记录"}</td>{isAdmin ? <td><button className="button compact" disabled={saving} onClick={() => { setEditing({ ...record } as BigStackRecord); setReason(""); }}>编辑</button> <button className="button compact" onClick={() => removeRecord(record)} disabled={saving}>删除</button></td> : null}</tr>)}
        {!visibleRecords.length ? <tr><td colSpan={isAdmin ? 5 : 4}>该项目暂未录入大堆成绩。</td></tr> : null}
      </tbody></table></div>
      <div className="big-stack-pb-pagination"><button className="button compact" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>上一页</button><span>第 {safePage} / {pageCount} 页</span><button className="button compact" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>下一页</button></div>
    </section>

    {editing ? <div className="weekly-admin-login-backdrop" role="presentation"><section className="weekly-admin-login-modal weekly-player-editor-modal" role="dialog" aria-modal="true" aria-label="编辑大堆记录"><div className="admin-card-heading"><div><span className="eyebrow">长期 PB</span><h2>编辑记录</h2><p>降低成绩、修改姓名或身份绑定时必须填写原因。</p></div></div><form className="weekly-player-editor-grid" onSubmit={saveRecord}>
      <label className="field"><span>姓名</span><input required value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
      <label className="field"><span>项目</span><select value={editing.eventId} onChange={(event) => setEditing({ ...editing, eventId: event.target.value as BigStackEventId })}>{["333", "222", "pyram", "maple", "mirror"].map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
      <label className="field"><span>还原数量</span><input required min="0" type="number" value={editing.solveCount} onChange={(event) => setEditing({ ...editing, solveCount: Number(event.target.value) })} /></label>
      <label className="field"><span>关联周赛选手（沿用原编号）</span><select value={editing.playerId || ""} onChange={(event) => { const player = playersById.get(event.target.value); setEditing({ ...editing, playerId: event.target.value || undefined, wcaId: player ? player.wcaId || "" : editing.wcaId }); }}><option value="">暂未关联</option>{players.map((player) => <option key={player.id} value={player.id}>{player.weeklyNumber ? `${player.weeklyNumber} · ` : ""}{player.name}{player.wcaId ? ` · ${player.wcaId}` : ""}</option>)}</select></label>
      <label className="field"><span>WCA ID（已关联时沿用周赛绑定）</span><input readOnly={Boolean(editing.playerId)} value={editing.wcaId || ""} onChange={(event) => setEditing({ ...editing, wcaId: event.target.value.toUpperCase() })} /></label>
      <label className="field"><span>达成日期</span><input type="date" value={editing.achievedAt || ""} onChange={(event) => setEditing({ ...editing, achievedAt: event.target.value })} /></label>
      <label className="field"><span>来源周赛</span><select value={editing.meetId || ""} onChange={(event) => setEditing({ ...editing, meetId: event.target.value || null })}><option value="">非特定周赛 / 待补</option>{meets.map((meet) => <option key={meet.id} value={meet.id}>{meet.title}</option>)}</select></label>
      <label className="field"><span>来源说明</span><input value={editing.sourceLabel} onChange={(event) => setEditing({ ...editing, sourceLabel: event.target.value })} /></label>
      <label className="field"><span>备注</span><input value={editing.note} onChange={(event) => setEditing({ ...editing, note: event.target.value })} /></label>
      <label className="field"><span>修改原因</span><input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <div className="weekly-admin-login-actions"><button className="button" type="button" onClick={() => setEditing(null)}>取消</button><button className="button primary" disabled={saving}>{saving ? "保存中…" : "保存"}</button></div>
    </form></section></div> : null}
  </>;
}

function ImportPreview({ preview }: { preview: BigStackImportPreview }) {
  const summary = preview.summary;
  return <section className="big-stack-pb-preview"><div className="big-stack-pb-stats"><span>总行数 <strong>{summary.total}</strong></span>{preview.mode === "baseline" ? <span>将替换 <strong>{summary.replace}</strong></span> : null}<span>新增 <strong>{summary.inserted}</strong></span><span>刷新 PB <strong>{summary.improved}</strong></span><span>不变 <strong>{summary.unchanged}</strong></span><span>较低忽略 <strong>{summary.lowerIgnored}</strong></span><span>未绑定 <strong>{summary.unresolved}</strong></span><span>歧义 <strong>{summary.ambiguous}</strong></span></div>{preview.errors.length ? <div className="big-stack-pb-errors"><strong>必须修正</strong>{preview.errors.map((error) => <p key={error}>{error}</p>)}</div> : null}{preview.warnings.length ? <details><summary>匹配提醒（{preview.warnings.length}）</summary>{preview.warnings.slice(0, 100).map((warning) => <p key={warning}>{warning}</p>)}</details> : null}</section>;
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
