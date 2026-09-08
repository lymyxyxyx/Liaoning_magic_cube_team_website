"use client";

import { ChangeEvent, useState } from "react";
import { FileUp, RotateCcw, Send, TriangleAlert } from "lucide-react";
import type { WeeklyImportBatch, WeeklyImportResolution } from "@/lib/weekly-player-admin-store";
import type { WeeklyPlayerImportPreviewRow } from "@/lib/weekly-player-import";

export function WeeklyPlayerImportConsole({ initialBatches }: { initialBatches: WeeklyImportBatch[] }) {
  const [batches, setBatches] = useState(initialBatches);
  const [batch, setBatch] = useState<WeeklyImportBatch | null>(null);
  const [resolutions, setResolutions] = useState<Record<number, WeeklyImportResolution>>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true); setNotice("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/admin/weekly-player-imports", { method: "POST", body: form });
      const payload = await response.json();
      if (response.status === 409) {
        setNotice(`${payload.message}（批次：${payload.duplicate?.id || "—"}）`);
        return;
      }
      if (!response.ok) throw new Error(payload.message || "解析失败");
      setBatch(payload.batch); setBatches((current) => [payload.batch, ...current]); setResolutions({});
      setNotice("已生成预览；尚未写入任何选手资料。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "解析失败"); } finally { setBusy(false); }
  }

  function setResolution(row: WeeklyPlayerImportPreviewRow, value: string) {
    if (!value) {
      setResolutions((current) => {
        const next = { ...current };
        delete next[row.rowNumber];
        return next;
      });
      return;
    }
    if (value === "create") {
      setResolutions((current) => ({ ...current, [row.rowNumber]: { rowNumber: row.rowNumber, action: "create" } }));
      return;
    }
    const playerId = value.replace(/^link:/, "");
    setResolutions((current) => ({ ...current, [row.rowNumber]: { rowNumber: row.rowNumber, action: "link", playerId } }));
  }

  function setConflict(rowNumber: number, field: "gender" | "birthDate", value: "" | "keep_existing" | "use_excel") {
    setResolutions((current) => ({
      ...current, [rowNumber]: {
        ...current[rowNumber], rowNumber,
        conflictChoices: { ...current[rowNumber]?.conflictChoices, [field]: value || undefined }
      }
    }));
  }

  async function commit() {
    if (!batch || !window.confirm("确认按当前预览写入选手库？此操作会创建或更新选手档案。")) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/weekly-player-imports/${batch.id}/commit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolutions: Object.values(resolutions) })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "提交失败");
      setBatch(payload.batch); setBatches((current) => current.map((item) => item.id === payload.batch.id ? payload.batch : item));
      setNotice("导入批次已原子提交。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "提交失败"); } finally { setBusy(false); }
  }

  async function rollback() {
    if (!batch || !window.confirm("确认回滚此批次？未被成绩引用的新建选手会删除；已有成绩引用的选手会停用。")) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/weekly-player-imports/${batch.id}/rollback`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "回滚失败");
      setBatch(payload.batch); setBatches((current) => current.map((item) => item.id === payload.batch.id ? payload.batch : item));
      setNotice("批次回滚完成。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "回滚失败"); } finally { setBusy(false); }
  }

  const preview = batch?.preview;
  const attentionRows = preview?.rows.filter((row) => row.warnings.length || row.errors.length || row.match.type === "exact_name" || row.match.type === "ambiguous_name" || row.match.type === "similar_name" || row.match.fieldConflicts.length) || [];
  return <section className="container section weekly-admin-workspace">
    <div className="admin-card">
      <div className="admin-card-heading"><div><h2>上传并预览</h2><p>只读取 Sheet1 的姓名、性别和出生日期；不保存电话、联系人关系、渠道、提交时间或原始备注。</p></div></div>
      <label className="button primary"><FileUp size={16} />{busy ? "处理中" : "选择 .xlsx 文件"}<input hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={upload} disabled={busy} /></label>
      {notice ? <p className="admin-inline-notice">{notice}</p> : null}
    </div>
    {preview && batch ? <div className="admin-card weekly-admin-preview">
      <div className="admin-card-heading"><div><h2>导入预览：{batch.filename}</h2><p>批次状态：{batch.status}。确认前不会写入选手库。</p></div></div>
      <div className="stat-band"><Stat value={preview.rawRowCount} label="Excel 总行数" /><Stat value={preview.validRowCount} label="可解析选手" /><Stat value={preview.exactNameMatchCount} label="姓名推荐关联" /><Stat value={preview.newPlayerCount} label="建议新建" /><Stat value={preview.ambiguousMatchCount} label="需人工确认" /><Stat value={preview.invalidBirthDateCount} label="非标准生日" /><Stat value={preview.genderUnknownCount} label="性别未知" /><Stat value={preview.updateCount} label="可能更新" /></div>
      <p>预览只保留允许写入的字段和匹配结果，原始报名资料不会存入批次 JSON。</p>
      {attentionRows.length ? <div className="table-scroll"><table className="result-table"><thead><tr><th>Excel 行</th><th>姓名</th><th>生日 / 性别</th><th>问题或候选</th><th>处理</th></tr></thead><tbody>{attentionRows.map((row) => <tr key={row.rowNumber}>
        <td>{row.rowNumber}</td><td>{row.name || "（空）"}</td><td>{row.birthDate || "未写入"}<br /><small>{row.gender || "性别未知"}</small></td>
        <td>{[...row.errors, ...row.warnings, matchLabel(row)].join("；") || "字段冲突"}{row.match.candidates.length ? <ul>{row.match.candidates.map((candidate) => <li key={candidate.id}>{candidate.name} · {candidate.id} · {candidate.wcaId || "无 WCA ID"}</li>)}</ul> : null}</td>
        <td>{renderResolution(row, resolutions[row.rowNumber], setResolution, setConflict)}</td>
      </tr>)}</tbody></table></div> : <p>没有异常或人工确认项。</p>}
      <div className="weekly-admin-actions">
        {batch.status === "committed" ? <button className="button" disabled={busy} type="button" onClick={rollback}><RotateCcw size={16} />回滚此批次</button> : batch.status !== "rolled_back" ? <button className="button primary" disabled={busy || preview.errorCount > 0} type="button" onClick={commit}><Send size={16} />确认并提交</button> : <span>此批次已回滚。</span>}
        {preview.errorCount > 0 ? <span className="status"><TriangleAlert size={15} />请先处理无效行后重新上传。</span> : null}
      </div>
    </div> : null}
    <div className="admin-card"><div className="admin-card-heading"><div><h2>最近导入批次</h2><p>相同 SHA-256 且已提交的文件会被阻止重复导入。</p></div></div><div className="table-scroll"><table className="result-table"><thead><tr><th>文件</th><th>状态</th><th>有效行</th><th>创建时间</th><th>操作</th></tr></thead><tbody>{batches.map((item) => <tr key={item.id}><td>{item.filename}<br /><small>{item.id}</small></td><td>{item.status}</td><td>{item.validRowCount}</td><td>{new Date(item.createdAt).toLocaleString("zh-CN")}</td><td><button className="button compact" type="button" onClick={() => { setBatch(item); setResolutions({}); }}>查看</button></td></tr>)}</tbody></table></div></div>
  </section>;
}

function Stat({ value, label }: { value: number; label: string }) { return <div className="stat"><strong>{value}</strong><span>{label}</span></div>; }

function matchLabel(row: WeeklyPlayerImportPreviewRow) {
  const labels = { new: "新选手", player_id: "player_id 匹配", wca_id: "唯一 WCA ID 匹配", exact_name: "姓名推荐关联", ambiguous_name: "同名候选，必须确认", similar_name: "近似姓名候选，必须确认" };
  return labels[row.match.type];
}

function renderResolution(
  row: WeeklyPlayerImportPreviewRow,
  resolution: WeeklyImportResolution | undefined,
  onResolve: (row: WeeklyPlayerImportPreviewRow, value: string) => void,
  onConflict: (rowNumber: number, field: "gender" | "birthDate", value: "" | "keep_existing" | "use_excel") => void
) {
  const needsChoice = row.match.type === "exact_name" || row.match.type === "ambiguous_name" || row.match.type === "similar_name";
  const isUniqueNameRecommendation = row.match.type === "exact_name";
  const isLinking = resolution?.action === "link";
  const selectedCandidate = isLinking ? row.match.candidates.find((candidate) => candidate.id === resolution.playerId) : undefined;
  const selectedConflicts: ("gender" | "birthDate")[] = selectedCandidate ? [
    ...(row.gender && selectedCandidate.gender && row.gender !== selectedCandidate.gender ? ["gender" as const] : []),
    ...(row.birthDate && selectedCandidate.birthDate && row.birthDate !== selectedCandidate.birthDate ? ["birthDate" as const] : [])
  ] : [];
  return <div>
    {needsChoice ? <select value={resolution?.action === "link" ? `link:${resolution.playerId}` : resolution?.action || ""} onChange={(event) => onResolve(row, event.target.value)}><option value="">请选择处理方式</option>{row.match.candidates.map((candidate) => <option key={candidate.id} value={`link:${candidate.id}`}>{isUniqueNameRecommendation ? "关联现有选手：" : "关联候选选手："}{candidate.name}（{candidate.id}）</option>)}<option value="create">作为新选手创建</option></select> : null}
    {isLinking ? selectedConflicts.map((field) => <label key={field} className="weekly-import-conflict">{field === "gender" ? "性别冲突" : "生日冲突"}<select value={resolution?.conflictChoices?.[field] || ""} onChange={(event) => onConflict(row.rowNumber, field, event.target.value as "" | "keep_existing" | "use_excel")}><option value="">请选择冲突字段处理方式</option><option value="keep_existing">保留数据库值</option><option value="use_excel">使用 Excel 值</option></select></label>) : null}
  </div>;
}
