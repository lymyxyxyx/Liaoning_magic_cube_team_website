"use client";

import { ChangeEvent, useState } from "react";
import { FileDown, FileUp, RotateCcw, Search, Send, UserPlus } from "lucide-react";
import type { WeeklyResultsImportBatch, WeeklyResultsImportPreviewRow } from "@/lib/weekly-results-import-store";

type SearchPlayer = { id: string; name: string; wcaId?: string; status?: "active" | "inactive"; province?: string; city?: string };

export function WeeklyResultsImportConsole({ meetId, templateUrl, events }: { meetId: string; templateUrl: string; events: Array<{ eventId: string; format: string; enabled: boolean }> }) {
  const [batch, setBatch] = useState<WeeklyResultsImportBatch | null>(null);
  const [paste, setPaste] = useState("");
  const [pasteEventCode, setPasteEventCode] = useState(events.find((event) => event.enabled)?.eventId || "");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [searchForRow, setSearchForRow] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchPlayer[]>([]);
  const enabledEvents = events.filter((event) => event.enabled);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    const form = new FormData(); form.set("meetId", meetId); form.set("source", "xlsx"); form.set("file", file);
    await createPreview(form);
  }

  async function previewPaste() {
    const form = new FormData(); form.set("meetId", meetId); form.set("source", "paste"); form.set("paste", paste); form.set("eventCode", pasteEventCode);
    await createPreview(form);
  }

  async function createPreview(form: FormData) {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/weekly-results-imports", { method: "POST", body: form });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "生成预览失败");
      setBatch(payload.batch); setSearchForRow(null); setSearchResults([]); setNotice("已保存导入预览；本轮不会写入正式成绩。");
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
      setBatch(payload.batch); setNotice("成绩批次已原子提交，并已重算 ranking 与 PB。");
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
  return <section className="container section weekly-admin-workspace">
    <div className="admin-card">
      <div className="admin-card-heading"><div><h2>标准 Excel 导入</h2><p>只支持本页下载的“比赛信息”和“成绩”两个固定工作表。赛制与尝试次数始终以当前周赛配置为准。</p></div></div>
      <div className="weekly-admin-actions"><a className="button" href={templateUrl}><FileDown size={16} />下载本期成绩模板</a><label className="button primary"><FileUp size={16} />{busy ? "处理中" : "上传标准 Excel"}<input hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={upload} disabled={busy} /></label></div>
      {notice ? <p className="admin-inline-notice">{notice}</p> : null}
    </div>
    <div className="admin-card">
      <div className="admin-card-heading"><div><h2>批量粘贴</h2><p>粘贴后复用同一归一化、项目校验、选手匹配与预览流程。可粘贴“姓名 + 尝试成绩”，或包含 player_id、WCA ID 的制表符行。</p></div></div>
      <div className="weekly-admin-actions"><label>项目 <select value={pasteEventCode} onChange={(event) => setPasteEventCode(event.target.value)}>{enabledEvents.map((event) => <option key={event.eventId} value={event.eventId}>{event.eventId} · {event.format}</option>)}</select></label><button className="button" type="button" disabled={busy || !paste.trim() || !pasteEventCode} onClick={previewPaste}>生成粘贴预览</button></div>
      <textarea className="weekly-paste-box" value={paste} onChange={(event) => setPaste(event.target.value)} placeholder={"陈小明\t12.34\t12.50\t12.18\t12.60\t12.41"} />
    </div>
    {preview && batch ? <Preview batch={batch} onResolve={resolve} onCommit={commit} onRollback={rollback} busy={busy} searchForRow={searchForRow} setSearchForRow={setSearchForRow} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={searchResults} onSearch={searchPlayers} onCreate={createPlayer} /> : null}
  </section>;
}

function Preview({ batch, onResolve, onCommit, onRollback, busy, searchForRow, setSearchForRow, searchQuery, setSearchQuery, searchResults, onSearch, onCreate }: { batch: WeeklyResultsImportBatch; onResolve: (row: WeeklyResultsImportPreviewRow, id: string) => Promise<void>; onCommit: () => Promise<void>; onRollback: () => Promise<void>; busy: boolean; searchForRow: number | null; setSearchForRow: (row: number | null) => void; searchQuery: string; setSearchQuery: (value: string) => void; searchResults: SearchPlayer[]; onSearch: () => Promise<void>; onCreate: (row: WeeklyResultsImportPreviewRow) => Promise<void> }) {
  const { preview } = batch;
  return <div className="admin-card weekly-admin-preview">
    <div className="admin-card-heading"><div><h2>导入预览：{batch.filename}</h2><p>批次状态：{batch.status}。提交时会在一个事务内再次校验、写入成绩与尝试，并重算 ranking/PB。</p></div></div>
    <div className="weekly-admin-actions">{batch.status === "ready" ? <button className="button primary" type="button" disabled={busy} onClick={onCommit}><Send size={16} />确认并提交成绩</button> : null}{batch.status === "committed" ? <button className="button" type="button" disabled={busy} onClick={onRollback}><RotateCcw size={16} />回滚本批成绩</button> : null}{batch.status === "rolled_back" ? <span>此批次已回滚。</span> : null}</div>
    <div className="stat-band"><Stat value={preview.rawRowCount} label="总行数" /><Stat value={preview.validRowCount} label="可提交行数" /><Stat value={preview.warningCount} label="warning" /><Stat value={preview.errorCount} label="error" /><Stat value={preview.exactPlayerIdMatchCount} label="player_id 精确匹配" /><Stat value={preview.wcaIdMatchCount} label="WCA ID 匹配" /><Stat value={preview.nameRecommendationCount} label="姓名推荐" /><Stat value={preview.unmatchedCount} label="未匹配" /><Stat value={preview.conflictCount} label="冲突" /><Stat value={preview.existingResultCount} label="已有成绩" /></div>
    {preview.globalErrors.length ? <p className="status error">{preview.globalErrors.join("；")}</p> : null}{preview.globalWarnings.length ? <p className="status">{preview.globalWarnings.join("；")}</p> : null}
    <div className="table-scroll"><table className="result-table"><thead><tr><th>行</th><th>项目</th><th>Excel 姓名</th><th>匹配选手 / player_id</th><th>尝试（内部为百分之一秒）</th><th>best / average</th><th>warning / error</th><th>处理状态</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.sourceRow}>
      <td>{row.sourceRow}</td><td>{row.eventCode || "—"}</td><td>{row.playerName || "—"}<br /><small>{row.wcaId || row.playerId || "无身份字段"}</small></td>
      <td>{row.matchedPlayerId && searchForRow !== row.sourceRow ? <>{row.matchedPlayerName}<br /><small>{row.matchedPlayerId}{row.matchedPlayerStatus === "inactive" ? " · inactive" : ""}</small><br /><button className="button compact" type="button" disabled={busy} onClick={() => setSearchForRow(row.sourceRow)}>更换匹配</button></> : <MatchControls row={row} onResolve={onResolve} busy={busy} searchOpen={searchForRow === row.sourceRow} onToggleSearch={() => setSearchForRow(searchForRow === row.sourceRow ? null : row.sourceRow)} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={searchResults} onSearch={onSearch} onCreate={onCreate} />}</td>
      <td>{row.attempts.map((attempt) => typeof attempt === "number" ? `${formatCentiseconds(attempt)} (${attempt} cs)` : attempt).join(" / ") || "—"}</td><td>{row.bestText} / {row.averageText}</td><td>{[...row.warnings, ...row.errors].join("；") || "—"}</td><td>{statusLabel(row)}</td>
    </tr>)}</tbody></table></div>
  </div>;
}

function MatchControls({ row, onResolve, busy, searchOpen, onToggleSearch, searchQuery, setSearchQuery, searchResults, onSearch, onCreate }: { row: WeeklyResultsImportPreviewRow; onResolve: (row: WeeklyResultsImportPreviewRow, id: string) => Promise<void>; busy: boolean; searchOpen: boolean; onToggleSearch: () => void; searchQuery: string; setSearchQuery: (value: string) => void; searchResults: SearchPlayer[]; onSearch: () => Promise<void>; onCreate: (row: WeeklyResultsImportPreviewRow) => Promise<void> }) {
  return <div className="weekly-result-import-match"><span>{row.recommendedPlayerId ? "建议确认候选" : "未自动关联"}</span>{row.candidates.map((candidate) => <button className="button compact" type="button" disabled={busy} key={candidate.id} onClick={() => onResolve(row, candidate.id)}>选 {candidate.name} · {candidate.id}</button>)}<button className="button compact" type="button" disabled={busy} onClick={onToggleSearch}><Search size={14} />搜索</button><button className="button compact" type="button" disabled={busy || !row.playerName} onClick={() => onCreate(row)}><UserPlus size={14} />新建</button>{searchOpen ? <div><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="姓名、WCA ID 或拼音" /><button className="button compact" type="button" disabled={busy} onClick={onSearch}>查找</button>{searchResults.map((player) => <button className="button compact" type="button" disabled={busy} key={player.id} onClick={() => onResolve(row, player.id)}>{player.name} · {player.id}{player.status === "inactive" ? "（inactive）" : ""}</button>)}</div> : null}</div>;
}

function Stat({ value, label }: { value: number; label: string }) { return <div className="stat"><strong>{value}</strong><span>{label}</span></div>; }
function formatCentiseconds(value: number) { const minutes = Math.floor(value / 6000); const seconds = Math.floor((value % 6000) / 100); const centiseconds = value % 100; return minutes ? `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}` : `${seconds}.${String(centiseconds).padStart(2, "0")}`; }
function statusLabel(row: WeeklyResultsImportPreviewRow) { if (row.errors.length) return "阻止"; if (!row.matchedPlayerId) return row.handlingStatus === "recommended" ? "等待确认姓名推荐" : "等待人工处理"; return row.existingResult ? "已有成绩冲突" : "可提交"; }
