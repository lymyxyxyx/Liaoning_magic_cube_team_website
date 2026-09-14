"use client";

import { ChangeEvent, useRef, useState } from "react";
import { FileDown, FileUp, RotateCcw, Search, Send, UserPlus } from "lucide-react";
import type { WeeklyResultsImportBatch, WeeklyResultsImportPreviewRow } from "@/lib/weekly-results-import-store";

type SearchPlayer = { id: string; name: string; wcaId?: string; status?: "active" | "inactive"; province?: string; city?: string };

type Props = {
  meetId: string;
  templateUrl: string;
  events: Array<{ eventId: string; format: string; enabled: boolean }>;
  /** Removes the page-level container when the importer is opened inside the score-entry panel. */
  embedded?: boolean;
  onCommitted?: () => void;
};

export function WeeklyResultsImportConsole({ meetId, templateUrl, events, embedded = false, onCommitted }: Props) {
  const [batch, setBatch] = useState<WeeklyResultsImportBatch | null>(null);
  const [paste, setPaste] = useState("");
  const [pasteEventCode, setPasteEventCode] = useState(events.find((event) => event.enabled)?.eventId || "");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchForRow, setSearchForRow] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchPlayer[]>([]);
  const pasteRef = useRef<HTMLTextAreaElement | null>(null);
  const enabledEvents = events.filter((event) => event.enabled);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    const form = new FormData(); form.set("meetId", meetId); form.set("source", "xlsx"); form.set("file", file);
    await createPreview(form);
  }

  async function previewPaste(rawPaste = paste) {
    const form = new FormData(); form.set("meetId", meetId); form.set("source", "paste"); form.set("paste", rawPaste); form.set("eventCode", pasteEventCode);
    await createPreview(form);
  }

  function previewAfterPaste() {
    // A real paste is already a complete score block. Parse it after the
    // browser writes the textarea value, instead of making the operator
    // click an extra button before seeing the pending entries.
    window.setTimeout(() => {
      const pastedText = pasteRef.current?.value.trim() || "";
      if (pastedText && pasteEventCode) void previewPaste(pastedText);
    }, 0);
  }

  async function createPreview(form: FormData) {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/weekly-results-imports", { method: "POST", body: form });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "生成预览失败");
      setBatch(payload.batch); setSearchForRow(null); setSearchResults([]); setNotice("已带出待确认成绩；确认前不会写入正式成绩。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "生成预览失败"); } finally { setBusy(false); }
  }

  async function resolve(row: WeeklyResultsImportPreviewRow, playerId: string) {
    if (!batch || !playerId) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/weekly-results-imports/${encodeURIComponent(batch.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetId, resolutions: [{ sourceRow: row.sourceRow, playerId }] }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "更新匹配失败");
      setBatch(payload.batch); setSearchForRow(null); setSearchResults([]); setNotice("已更新该预览行的正式 player_id；尚未写入成绩。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "更新匹配失败"); } finally { setBusy(false); }
  }

  async function resolveAllRecommended(rows: WeeklyResultsImportPreviewRow[]) {
    if (!batch) return;
    const resolutions = rows
      .filter((row) => row.handlingStatus === "recommended" && row.recommendedPlayerId && row.errors.length === 0 && !row.existingResult)
      .map((row) => ({ sourceRow: row.sourceRow, playerId: row.recommendedPlayerId }));
    if (!resolutions.length) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/weekly-results-imports/${encodeURIComponent(batch.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetId, resolutions }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "确认推荐匹配失败");
      setBatch(payload.batch); setNotice(`已确认 ${resolutions.length} 条姓名推荐；仍可逐条修改。`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "确认推荐匹配失败"); } finally { setBusy(false); }
  }

  async function searchPlayers() {
    if (searchForRow === null) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/weekly-players?q=${encodeURIComponent(searchQuery)}`); const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "搜索选手失败"); setSearchResults(payload.players || []);
    } catch (error) { setNotice(error instanceof Error ? error.message : "搜索选手失败"); } finally { setBusy(false); }
  }

  async function createPlayer(row: WeeklyResultsImportPreviewRow) {
    if (!window.confirm(`为“${row.playerName || "该行"}”创建正式选手档案？创建后只会关联预览行，不会写入成绩。`)) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/weekly-players", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: row.playerName, wcaId: row.wcaId, confirmSameName: true }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "创建选手失败");
      await resolve(row, payload.player.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "创建选手失败"); setBusy(false); }
  }

  async function commit() {
    if (!batch || !window.confirm("确认提交这个 ready 成绩批次？将写入正式成绩、尝试、排名与 PB。")) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/weekly-results-imports/${encodeURIComponent(batch.id)}/commit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetId }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "提交成绩失败");
      setBatch(payload.batch); setNotice("成绩批次已原子提交，并已重算 ranking 与 PB。"); onCommitted?.();
    } catch (error) { setNotice(error instanceof Error ? error.message : "提交成绩失败"); } finally { setBusy(false); }
  }

  async function rollback() {
    if (!batch || !window.confirm("确认回滚这个批次创建的成绩？如果任一成绩已被人工修订，系统会停止并要求人工处理。")) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/weekly-results-imports/${encodeURIComponent(batch.id)}/rollback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetId }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "回滚成绩失败");
      setBatch(payload.batch); setNotice("已回滚本批创建的成绩，并恢复相关 ranking 与 PB。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "回滚成绩失败"); } finally { setBusy(false); }
  }

  const preview = batch?.preview;
  return <section className={`${embedded ? "weekly-inline-import-console" : "container section weekly-admin-workspace"}`}>
    <div className="admin-card">
      <div className="admin-card-heading"><div><h2>标准 Excel 导入</h2><p>只支持本页下载的“比赛信息”和“成绩”两个固定工作表。赛制与尝试次数始终以当前周赛配置为准。</p></div></div>
      <div className="weekly-admin-actions"><a className="button" href={templateUrl}><FileDown size={16} />下载本期成绩模板</a><label className="button primary"><FileUp size={16} />{busy ? "处理中" : "上传标准 Excel"}<input hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={upload} disabled={busy} /></label></div>
      {notice ? <p className="admin-inline-notice">{notice}</p> : null}
    </div>
    <div className="admin-card">
      <div className="admin-card-heading"><div><h2>智能粘贴导入</h2><p>可直接粘贴聊天或表格中的整段成绩：支持制表符、空格、逗号、中文逗号与斜杠分隔；会跳过常见表头，识别排名、DNF/DNS、12秒34、1分02秒34等写法。</p></div></div>
      <div className="weekly-admin-actions"><label>项目 <select value={pasteEventCode} onChange={(event) => setPasteEventCode(event.target.value)}>{enabledEvents.map((event) => <option key={event.eventId} value={event.eventId}>{event.eventId} · {event.format}</option>)}</select></label><button className="button" type="button" disabled={busy || !paste.trim() || !pasteEventCode} onClick={() => previewPaste()}>重新解析</button></div>
      <textarea ref={pasteRef} className="weekly-paste-box" value={paste} onPaste={previewAfterPaste} onChange={(event) => setPaste(event.target.value)} placeholder={"直接粘贴成绩后会自动带出待确认清单\n\n排名 姓名 T1 T2 T3 T4 T5\n1 陈小明 12秒34 12.50 12.18 12.60 12.41\n2 李小红，13.05/13.22/12.97/13.40/13.11"} />
    </div>
    {preview && batch ? <Preview batch={batch} onResolve={resolve} onResolveAll={resolveAllRecommended} onCommit={commit} onRollback={rollback} busy={busy} searchForRow={searchForRow} setSearchForRow={setSearchForRow} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={searchResults} onSearch={searchPlayers} onCreate={createPlayer} /> : null}
  </section>;
}

function Preview({ batch, onResolve, onResolveAll, onCommit, onRollback, busy, searchForRow, setSearchForRow, searchQuery, setSearchQuery, searchResults, onSearch, onCreate }: { batch: WeeklyResultsImportBatch; onResolve: (row: WeeklyResultsImportPreviewRow, id: string) => Promise<void>; onResolveAll: (rows: WeeklyResultsImportPreviewRow[]) => Promise<void>; onCommit: () => Promise<void>; onRollback: () => Promise<void>; busy: boolean; searchForRow: number | null; setSearchForRow: (row: number | null) => void; searchQuery: string; setSearchQuery: (value: string) => void; searchResults: SearchPlayer[]; onSearch: () => Promise<void>; onCreate: (row: WeeklyResultsImportPreviewRow) => Promise<void> }) {
  const { preview } = batch;
  const recommendedRows = preview.rows.filter((row) => row.handlingStatus === "recommended" && row.recommendedPlayerId && row.errors.length === 0 && !row.existingResult);
  const confirmedRows = preview.rows.filter((row) => Boolean(row.matchedPlayerId)).length;
  const needsAttention = preview.rows.filter((row) => row.errors.length || row.existingResult || (!row.matchedPlayerId && row.handlingStatus !== "recommended")).length;
  return <div className="admin-card weekly-admin-preview">
    <div className="admin-card-heading"><div><h2>待确认成绩</h2><p>系统已解析 {preview.rawRowCount} 条。请确认选手匹配；确认后才可提交。任一行都可单独修改选手。</p></div></div>
    <div className="weekly-import-confirmation-summary"><span><strong>{confirmedRows}</strong> 已确认</span><span><strong>{recommendedRows.length}</strong> 待确认</span><span className={needsAttention ? "is-warning" : undefined}><strong>{needsAttention}</strong> 需处理</span></div>
    <div className="weekly-admin-actions">
      {recommendedRows.length ? <button className="button" type="button" disabled={busy} onClick={() => onResolveAll(recommendedRows)}>确认全部姓名推荐</button> : null}
      {batch.status === "ready" ? <button className="button primary" type="button" disabled={busy} onClick={onCommit}><Send size={16} />确认并提交成绩</button> : null}
      {batch.status === "committed" ? <button className="button" type="button" disabled={busy} onClick={onRollback}><RotateCcw size={16} />回滚本批成绩</button> : null}
      {batch.status === "rolled_back" ? <span>此批次已回滚。</span> : null}
    </div>
    {preview.globalErrors.length ? <p className="status error">{preview.globalErrors.join("；")}</p> : null}{preview.globalWarnings.length ? <p className="status">{preview.globalWarnings.join("；")}</p> : null}
    <div className="weekly-import-confirmation-list">{preview.rows.map((row) => <article className="weekly-import-confirmation-row" key={row.sourceRow}>
      <div className="weekly-import-row-number"><strong>{row.sourceRow}</strong><small>{row.eventCode || "—"}</small></div>
      <div className="weekly-import-row-player"><strong>{row.playerName || "—"}</strong>{row.wcaId ? <small>{row.wcaId}</small> : null}</div>
      <div className="weekly-import-row-score"><strong>平均 {row.averageText} · 最快 {row.bestText}</strong><small>{row.attempts.map((attempt) => typeof attempt === "number" ? formatCentiseconds(attempt) : attempt).join(" / ") || "—"}</small></div>
      <div className="weekly-import-row-match">{row.matchedPlayerId ? <span className="weekly-import-match-confirmed">已确认：{row.matchedPlayerName}</span> : row.recommendedPlayerId ? <span className="weekly-import-match-recommended">建议：{row.candidates[0]?.name || row.playerName}</span> : <span className="weekly-import-match-unresolved">{statusLabel(row)}</span>}{[...row.warnings, ...row.errors].length ? <small className="weekly-import-row-warning">{[...row.warnings, ...row.errors].join("；")}</small> : null}</div>
      <div className="weekly-import-confirmation-actions"><MatchControls row={row} onResolve={onResolve} busy={busy} searchOpen={searchForRow === row.sourceRow} onToggleSearch={() => setSearchForRow(searchForRow === row.sourceRow ? null : row.sourceRow)} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={searchResults} onSearch={onSearch} onCreate={onCreate} /></div>
    </article>)}</div>
  </div>;
}

function MatchControls({ row, onResolve, busy, searchOpen, onToggleSearch, searchQuery, setSearchQuery, searchResults, onSearch, onCreate }: { row: WeeklyResultsImportPreviewRow; onResolve: (row: WeeklyResultsImportPreviewRow, id: string) => Promise<void>; busy: boolean; searchOpen: boolean; onToggleSearch: () => void; searchQuery: string; setSearchQuery: (value: string) => void; searchResults: SearchPlayer[]; onSearch: () => Promise<void>; onCreate: (row: WeeklyResultsImportPreviewRow) => Promise<void> }) {
  const candidate = row.candidates[0];
  const canConfirm = !row.matchedPlayerId && Boolean(row.recommendedPlayerId) && !row.errors.length && !row.existingResult;
  return <div className="weekly-result-import-match">
    {canConfirm && candidate ? <button className="button compact primary" type="button" disabled={busy} onClick={() => onResolve(row, candidate.id)}>确认 {candidate.name}</button> : null}
    <button className="button compact" type="button" disabled={busy} onClick={onToggleSearch}>{row.matchedPlayerId ? "修改选手" : <><Search size={14} />修改</>}</button>
    {!row.matchedPlayerId ? <button className="button compact" type="button" disabled={busy || !row.playerName} onClick={() => onCreate(row)}><UserPlus size={14} />新建选手</button> : null}
    {searchOpen ? <div className="weekly-result-import-search"><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="姓名、WCA ID 或拼音" /><button className="button compact" type="button" disabled={busy} onClick={onSearch}>查找</button>{searchResults.map((player) => <button className="button compact" type="button" disabled={busy} key={player.id} onClick={() => onResolve(row, player.id)}>选择 {player.name}{player.status === "inactive" ? "（停用）" : ""}</button>)}</div> : null}
  </div>;
}
function formatCentiseconds(value: number) { const minutes = Math.floor(value / 6000); const seconds = Math.floor((value % 6000) / 100); const centiseconds = value % 100; return minutes ? `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}` : `${seconds}.${String(centiseconds).padStart(2, "0")}`; }
function statusLabel(row: WeeklyResultsImportPreviewRow) { if (row.errors.length) return "阻止"; if (!row.matchedPlayerId) return row.handlingStatus === "recommended" ? "等待确认姓名推荐" : "等待人工处理"; return row.existingResult ? "已有成绩冲突" : "可提交"; }
