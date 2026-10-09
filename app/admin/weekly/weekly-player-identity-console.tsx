"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { WeeklyPlayerIdentity } from "@/lib/weekly-player-identity";
import type { WeeklyWcaMatchCandidate } from "@/lib/weekly-player-library";
import { matchesWeeklyPlayerQuery } from "@/lib/weekly-player-search";

export function WeeklyPlayerIdentityConsole() {
  const [players, setPlayers] = useState<WeeklyPlayerIdentity[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<(WeeklyPlayerIdentity & { reason: string; numberInput: string }) | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<WeeklyWcaMatchCandidate[]>([]);
  const [matching, setMatching] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/admin/weekly-player-identities", { cache: "no-store", signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "读取失败");
    setPlayers(body.players);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal).catch((error) => { if (!controller.signal.aborted) setNotice(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  const filtered = useMemo(() => players.filter((player) => matchesWeeklyPlayerQuery(player, query)), [players, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 50, currentPage * 50);
  async function matchWca() {
    if (!editor) return;
    setMatching(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/weekly-player-wca-matches?playerId=${encodeURIComponent(editor.id)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "匹配失败");
      setCandidates(body.candidates.filter((candidate: WeeklyWcaMatchCandidate) => candidate.status !== "rejected"));
      setNotice("已按姓名从辽宁魔友库匹配；请核对城市、性别后选择并保存。没有候选时仍可手动填写。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "匹配失败"); }
    finally { setMatching(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/admin/weekly-player-identities", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editor.id, expectedVersion: editor.version, weeklyNumber: Number(editor.numberInput), wcaId: editor.wcaId, wcaIdConfirmed: editor.wcaIdConfirmed, reason: editor.reason }) });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409 || response.status === 428) await refresh();
        throw new Error(body.message || "保存失败");
      }
      setPlayers((current) => current.map((player) => player.id === body.player.id ? body.player : player).sort((a,b)=>a.weeklyNumber-b.weeklyNumber));
      setEditor(null); setNotice("周赛编号和 WCA ID 已保存，关联的大堆记录已同步。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "保存失败"); }
    finally { setSaving(false); }
  }
  return <section className="container section"><div className="admin-card">
    <div className="admin-card-heading"><div><h2>周赛编号 / WCA ID</h2><p>大堆沿用普通周赛的选手编号，不另建号码。现有编号保留，新选手自动分配共用编号。修改 WCA ID 时请核对身份，已有成绩与 PB 保留。</p></div></div>
    <label>搜索选手<input value={query} onChange={(event)=>{setQuery(event.target.value);setPage(1);}} placeholder="周赛编号、姓名、拼音或 WCA ID" /></label>
    {notice ? <p className="admin-inline-notice" role="status">{notice}</p> : null}
    {loading ? <p>正在读取选手资料…</p> : <div className="table-scroll"><table className="result-table"><thead><tr><th>周赛编号</th><th>姓名</th><th>WCA ID</th><th>绑定状态</th><th>选手状态</th><th>操作</th></tr></thead><tbody>{visible.map((player)=><tr key={player.id}><td>{player.weeklyNumber}</td><td>{player.name}</td><td>{player.wcaId||"—"}</td><td>{player.wcaId ? player.wcaIdConfirmed ? "已确认" : "待核对" : "未绑定"}</td><td>{player.status==="active"?"启用":"停用"}</td><td><button className="button compact" disabled={saving || matching} onClick={()=>{setEditor({...player,reason:"",numberInput:String(player.weeklyNumber)});setCandidates([]);setNotice("");}}>编辑</button></td></tr>)}</tbody></table>{!visible.length?<p>没有符合条件的选手。</p>:null}</div>}
    <div className="weekly-admin-actions"><span>共 {filtered.length} 人，第 {currentPage}/{pages} 页</span><button className="button" disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}>上一页</button><button className="button" disabled={currentPage>=pages} onClick={()=>setPage(currentPage+1)}>下一页</button></div>
  </div>{editor ? <div className="weekly-admin-login-backdrop"><form className="weekly-admin-login-modal" onSubmit={save}><h2>编辑 {editor.name}</h2><div className="weekly-admin-grid">
    <label>周赛编号<input required type="number" min="1" max="999999" step="1" value={editor.numberInput} onChange={(event)=>setEditor({...editor,numberInput:event.target.value})} /></label>
    <label>WCA ID<input maxLength={10} value={editor.wcaId} placeholder="可留空" onChange={(event)=>setEditor({...editor,wcaId:event.target.value.toUpperCase(),wcaIdConfirmed:false})} /></label>
    <button className="button" type="button" disabled={matching || saving} onClick={matchWca}>{matching ? "匹配中…" : "从辽宁魔友库匹配 WCA ID"}</button>
    {candidates.length ? <div>{candidates.map((candidate) => <button className="button" key={candidate.id} type="button" disabled={saving || matching} onClick={()=>setEditor({...editor,wcaId:candidate.wcaId,wcaIdConfirmed:false})}>{candidate.wcaId} · {candidate.wcaName} · {candidate.city || "城市未填"} · {candidate.gender || "性别未填"}</button>)}</div> : null}
    {notice ? <p role="status">{notice}</p> : null}
    <label className="weekly-library-confirm-field"><span><input type="checkbox" checked={editor.wcaIdConfirmed} disabled={!editor.wcaId} onChange={(event)=>setEditor({...editor,wcaIdConfirmed:event.target.checked})} />已核对，此 WCA ID 属于该选手</span></label>
    <label>修改原因<textarea required maxLength={500} value={editor.reason} onChange={(event)=>setEditor({...editor,reason:event.target.value})} /></label>
    <p>清空 WCA ID 会解除绑定；修改编号不会改变成绩名次。遇到保存冲突，请取消并重新打开最新资料。</p>
    <div className="weekly-admin-login-actions"><button className="button" type="button" disabled={saving || matching} onClick={()=>setEditor(null)}>取消</button><button className="button primary" disabled={saving || matching} type="submit">{saving?"保存中…":"保存"}</button></div>
  </div></form></div> : null}</section>;
}
