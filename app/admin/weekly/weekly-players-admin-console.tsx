"use client";

import { FormEvent, useMemo, useState } from "react";
import { Pencil, Search } from "lucide-react";
import type { WeeklyLongCardProfile } from "@/lib/weekly-player-admin-store";
import { matchesWeeklyPlayerQuery } from "@/lib/weekly-player-search";

type LongCardForm = Pick<WeeklyLongCardProfile, "submittedAt" | "name" | "gender" | "birthDate" | "phone" | "contactRelationship" | "channel" | "notes" | "wcaId">;
const pageSize = 50;

export function WeeklyPlayersAdminConsole({ longCardProfiles }: { longCardProfiles: WeeklyLongCardProfile[] }) {
  const [profiles, setProfiles] = useState(longCardProfiles);
  const [query, setQuery] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{ profile: WeeklyLongCardProfile; form: LongCardForm } | null>(null);
  const [saving, setSaving] = useState(false);
  const [visiblePhones, setVisiblePhones] = useState<Set<number>>(() => new Set());
  const filtered = useMemo(() => profiles.filter((profile) => matchesWeeklyPlayerQuery({ name: profile.name, wcaId: profile.wcaId }, query)), [profiles, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const suggestions = useMemo(() => query.trim() ? filtered.slice(0, 8) : [], [filtered, query]);

  function updateQuery(value: string) { setQuery(value); setPage(1); setSuggestionsOpen(true); }
  function selectSuggestion(profile: WeeklyLongCardProfile) { setQuery(profile.name); setPage(1); setSuggestionsOpen(false); }
  function openEdit(profile: WeeklyLongCardProfile) {
    setNotice("");
    setEditor({ profile, form: { submittedAt: dateOnly(profile.submittedAt), name: profile.name, gender: profile.gender, birthDate: dateOnly(profile.birthDate), phone: profile.phone, contactRelationship: profile.contactRelationship, channel: profile.channel, notes: profile.notes, wcaId: profile.wcaId } });
  }
  function setField<K extends keyof LongCardForm>(field: K, value: LongCardForm[K]) { setEditor((current) => current ? { ...current, form: { ...current.form, [field]: value } } : null); }
  function phoneValue(profile: WeeklyLongCardProfile) {
    if (!profile.phone) return "—";
    const visible = visiblePhones.has(profile.sourceRowNumber);
    return <button className="weekly-phone-toggle" type="button" onClick={() => setVisiblePhones((current) => { const next = new Set(current); if (visible) next.delete(profile.sourceRowNumber); else next.add(profile.sourceRowNumber); return next; })}>{visible ? profile.phone : "点击显示电话"}</button>;
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editor) return;
    setSaving(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/weekly-long-card-profiles/${editor.profile.sourceRowNumber}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editor.form) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.message || "保存失败");
      setProfiles((current) => current.map((profile) => profile.sourceRowNumber === payload.profile.sourceRowNumber ? payload.profile : profile));
      setEditor(null); setNotice("长期卡学员资料已保存。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "保存失败"); } finally { setSaving(false); }
  }
  return <section className="container section weekly-admin-workspace">
    <div className="admin-card weekly-long-card-records">
      <div className="admin-card-heading"><div><h2>长期卡学员信息（{profiles.length} 条）</h2><p>按登记顺序显示。组别会按当天日期和完整出生日期自动更新；电话仅管理员可见。</p></div></div>
      <div className="weekly-long-card-search" role="search"><label>搜索学员<div className="weekly-long-card-search-input"><Search size={16} aria-hidden="true" /><input value={query} onChange={(event) => updateQuery(event.target.value)} onFocus={() => setSuggestionsOpen(true)} placeholder="姓名 / 拼音全拼 / 拼音首字母" role="combobox" aria-autocomplete="list" aria-expanded={suggestionsOpen && suggestions.length > 0} aria-controls="long-card-search-suggestions" /></div></label>
        {suggestionsOpen && suggestions.length > 0 ? <div id="long-card-search-suggestions" className="weekly-long-card-suggestions" role="listbox">{suggestions.map((profile) => <button key={profile.sourceRowNumber} type="button" role="option" aria-selected={false} onMouseDown={(event) => event.preventDefault()} onClick={() => selectSuggestion(profile)}>{profile.name}{profile.wcaId ? ` · ${profile.wcaId}` : ""}</button>)}</div> : null}
      </div>
      {notice ? <p className="admin-inline-notice">{notice}</p> : null}
      <div className="table-scroll weekly-admin-table-scroll"><table className="result-table weekly-admin-desktop-table"><thead><tr><th>提交日期</th><th>姓名</th><th>性别</th><th>出生日期</th><th>组别</th><th>WCA ID</th><th>联系电话（点击显示）</th><th>联系人所属关系</th><th>渠道</th><th>备注</th><th>操作</th></tr></thead><tbody>{visible.map((profile) => <tr key={profile.sourceRowNumber}><td>{dateOnly(profile.submittedAt) || "—"}</td><td>{profile.name}</td><td>{profile.gender || "—"}</td><td>{profile.birthDate || "—"}</td><td>{ageGroup(profile.birthDate)}</td><td>{profile.wcaId || "—"}</td><td>{phoneValue(profile)}</td><td>{profile.contactRelationship || "—"}</td><td>{profile.channel || "—"}</td><td>{profile.notes || "—"}</td><td><button className="button compact" type="button" onClick={() => openEdit(profile)}><Pencil size={14} />编辑</button></td></tr>)}</tbody></table></div>
      {visible.length === 0 ? <p className="empty-state">没有符合条件的学员。</p> : null}
      <div className="weekly-admin-actions"><span>共 {filtered.length} 条，第 {currentPage}/{pageCount} 页</span><button className="button" type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>上一页</button><button className="button" type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>下一页</button></div>
    </div>
    {editor ? <div className="weekly-admin-login-backdrop" role="presentation"><form className="weekly-admin-login-modal" onSubmit={save}><div className="admin-card-heading"><h2>编辑长期卡学员信息</h2><button className="button compact" type="button" onClick={() => setEditor(null)}>取消</button></div><div className="weekly-admin-grid"><label>提交日期<input type="date" value={editor.form.submittedAt} onChange={(event) => setField("submittedAt", event.target.value)} /></label><label>姓名<input value={editor.form.name} onChange={(event) => setField("name", event.target.value)} /></label><label>性别<select value={editor.form.gender} onChange={(event) => setField("gender", event.target.value)}><option value="">未知</option><option value="男">男</option><option value="女">女</option></select></label><label>出生日期<input type="date" value={editor.form.birthDate} onChange={(event) => setField("birthDate", event.target.value)} /></label><label>WCA ID<input value={editor.form.wcaId} onChange={(event) => setField("wcaId", event.target.value)} /></label><label>联系电话<input type="tel" value={editor.form.phone} onChange={(event) => setField("phone", event.target.value)} /></label><label>联系人所属关系<input value={editor.form.contactRelationship} onChange={(event) => setField("contactRelationship", event.target.value)} /></label><label>渠道<input value={editor.form.channel} onChange={(event) => setField("channel", event.target.value)} /></label><label className="full">备注<textarea rows={3} value={editor.form.notes} onChange={(event) => setField("notes", event.target.value)} /></label></div><div className="weekly-admin-login-actions"><button className="button primary" disabled={saving} type="submit"><Pencil size={16} />{saving ? "保存中" : "保存"}</button></div></form></div> : null}
  </section>;
}

function dateOnly(value: string) { const match = value.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : ""; }
function ageGroup(birthDate: string) { const normalized = dateOnly(birthDate); if (!normalized) return "—"; const [year, month, day] = normalized.split("-").map(Number); const today = new Date(); let age = today.getFullYear() - year; if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1; if (age < 0) return "—"; if (age < 6) return "U6"; if (age < 8) return "U8"; if (age < 10) return "U10"; if (age < 12) return "U12"; if (age < 18) return "U18"; return "成人组"; }
