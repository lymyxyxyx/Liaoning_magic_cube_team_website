"use client";

import { FormEvent, useMemo, useState } from "react";
import { Pencil, Plus, Search, UserRoundPlus } from "lucide-react";
import type { WeeklyLongCardProfile, WeeklyPlayerAdminList, WeeklyPlayerAdminListItem } from "@/lib/weekly-player-admin-store";

type PlayerForm = {
  name: string;
  gender: "" | "男" | "女";
  birthDate: string;
  wcaId: string;
  province: string;
  city: string;
  notes: string;
  status: "active" | "inactive";
  deactivationReason: string;
};

type LongCardForm = {
  submittedAt: string;
  name: string;
  gender: "" | "男" | "女";
  birthDate: string;
  phone: string;
  contactRelationship: string;
  channel: string;
  notes: string;
  wcaId: string;
};

const emptyForm: PlayerForm = {
  name: "", gender: "", birthDate: "", wcaId: "", province: "", city: "", notes: "", status: "active", deactivationReason: ""
};

export function WeeklyPlayersAdminConsole({ initial, longCardProfiles, openCreateInitially = false }: { initial: WeeklyPlayerAdminList; longCardProfiles: WeeklyLongCardProfile[]; openCreateInitially?: boolean }) {
  const [data, setData] = useState(initial);
  const [longCardData, setLongCardData] = useState(longCardProfiles);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [gender, setGender] = useState<"all" | "" | "男" | "女">("all");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; player?: WeeklyPlayerAdminListItem; form: PlayerForm; confirmSameName: boolean } | null>(openCreateInitially ? { mode: "create", form: emptyForm, confirmSameName: false } : null);
  const [longCardEditor, setLongCardEditor] = useState<{ profile: WeeklyLongCardProfile; form: LongCardForm } | null>(null);
  const [saving, setSaving] = useState(false);
  const [visiblePhones, setVisiblePhones] = useState<Set<number>>(() => new Set());

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const title = useMemo(() => editor?.mode === "create" ? "新建选手" : `编辑选手：${editor?.player?.name || ""}`, [editor]);

  async function load(page = 1) {
    const params = new URLSearchParams({ q: query, status, gender, page: String(page) });
    const response = await fetch(`/api/admin/weekly-players?${params}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "读取选手失败");
    setData(payload);
  }

  function search(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    load().catch((error) => setNotice(error instanceof Error ? error.message : "读取选手失败"));
  }

  function openCreate() {
    setNotice("");
    setEditor({ mode: "create", form: emptyForm, confirmSameName: false });
  }

  function openEdit(player: WeeklyPlayerAdminListItem) {
    setNotice("");
    setEditor({
      mode: "edit",
      player,
      confirmSameName: false,
      form: {
        name: player.name, gender: player.gender, birthDate: player.birthDate, wcaId: player.wcaId || "",
        province: player.province, city: player.city, notes: player.notes || "", status: player.status || "active",
        deactivationReason: player.deactivationReason || ""
      }
    });
  }

  function openLongCardEdit(profile: WeeklyLongCardProfile) {
    setNotice("");
    setLongCardEditor({
      profile,
      form: {
        submittedAt: dateOnly(profile.submittedAt), name: profile.name, gender: profile.gender === "男" || profile.gender === "女" ? profile.gender : "",
        birthDate: dateOnly(profile.birthDate), phone: profile.phone, contactRelationship: profile.contactRelationship,
        channel: profile.channel, notes: profile.notes, wcaId: profile.wcaId
      }
    });
  }

  function setField<K extends keyof PlayerForm>(field: K, value: PlayerForm[K]) {
    setEditor((current) => current ? { ...current, form: { ...current.form, [field]: value } } : null);
  }

  function setLongCardField<K extends keyof LongCardForm>(field: K, value: LongCardForm[K]) {
    setLongCardEditor((current) => current ? { ...current, form: { ...current.form, [field]: value } } : null);
  }

  function phoneValue(profile: WeeklyLongCardProfile | null) {
    if (!profile?.phone) return "—";
    const visible = visiblePhones.has(profile.sourceRowNumber);
    return <button className="weekly-phone-toggle" type="button" onClick={() => setVisiblePhones((current) => {
      const next = new Set(current);
      if (visible) next.delete(profile.sourceRowNumber);
      else next.add(profile.sourceRowNumber);
      return next;
    })}>{visible ? profile.phone : "点击显示电话"}</button>;
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setNotice("");
    try {
      const path = editor.mode === "create" ? "/api/admin/weekly-players" : `/api/admin/weekly-players/${editor.player?.id}`;
      const response = await fetch(path, {
        method: editor.mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editor.form, confirmSameName: editor.confirmSameName })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "保存失败");
      setEditor(null);
      setNotice(editor.mode === "create" ? "选手已创建。" : "选手资料已保存。");
      await load(data.page);
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      if (editor.mode === "create" && message.includes("同名")) {
        setEditor((current) => current ? { ...current, confirmSameName: true } : null);
        setNotice(`${message} 勾选确认后可建立独立档案。`);
      } else {
        setNotice(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveLongCard(event: FormEvent) {
    event.preventDefault();
    if (!longCardEditor) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/weekly-long-card-profiles/${longCardEditor.profile.sourceRowNumber}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(longCardEditor.form)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "保存失败");
      setLongCardData((current) => current.map((profile) => profile.sourceRowNumber === payload.profile.sourceRowNumber ? payload.profile : profile));
      setLongCardEditor(null);
      setNotice("长期卡学员资料已保存。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="container section weekly-admin-workspace">
      <div className="admin-card weekly-long-card-records">
        <div className="admin-card-heading">
          <div>
            <h2>长期卡学员信息（{longCardData.length} 条）</h2>
            <p>与附件 Sheet1 保持一行对应一行，并严格按原始表格顺序显示。电话仅管理员可见，点击后显示。</p>
          </div>
        </div>
        <div className="table-scroll weekly-admin-table-scroll">
          <table className="result-table weekly-admin-desktop-table">
            <thead><tr><th>提交日期</th><th>姓名</th><th>性别</th><th>出生日期</th><th>组别</th><th>WCA ID</th><th>联系电话（点击显示）</th><th>联系人所属关系</th><th>渠道</th><th>备注</th><th>操作</th></tr></thead>
            <tbody>{longCardData.map((profile) => <tr key={profile.sourceRowNumber}>
              <td>{dateOnly(profile.submittedAt) || "—"}</td><td>{profile.name}</td><td>{profile.gender || "—"}</td><td>{profile.birthDate || "—"}</td><td>{ageGroup(profile.birthDate)}</td><td>{profile.wcaId || "—"}</td><td>{phoneValue(profile)}</td><td>{profile.contactRelationship || "—"}</td><td>{profile.channel || "—"}</td><td>{profile.notes || "—"}</td><td><button className="button compact" type="button" onClick={() => openLongCardEdit(profile)}><Pencil size={14} />编辑</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>
      <div className="admin-card">
        <div className="admin-card-heading">
          <div>
            <h2>周赛选手档案</h2>
            <p>历史成绩保留其姓名快照。停用只影响以后新增成绩的默认选择，不删除已有成绩。</p>
          </div>
          <button className="button primary" type="button" onClick={openCreate}><UserRoundPlus size={16} />新建选手</button>
        </div>
        <form className="weekly-admin-grid" onSubmit={search}>
          <label className="full">姓名、WCA ID 或地区
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、WCA ID、省份或城市" />
          </label>
          <label>状态
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">全部</option><option value="active">active</option><option value="inactive">inactive</option></select>
          </label>
          <label>性别
            <select value={gender} onChange={(event) => setGender(event.target.value as typeof gender)}><option value="all">全部</option><option value="男">男</option><option value="女">女</option><option value="">未知</option></select>
          </label>
          <div className="weekly-admin-actions"><button className="button" type="submit"><Search size={16} />筛选</button></div>
        </form>
        {notice ? <p className="admin-inline-notice">{notice}</p> : null}
        <div className="table-scroll weekly-admin-table-scroll">
          <table className="result-table weekly-admin-desktop-table">
            <thead><tr><th>姓名</th><th>性别 / 出生日期</th><th>WCA ID</th><th>地区</th><th>长期卡资料</th><th>状态</th><th>成绩</th><th>最近参赛</th><th>操作</th></tr></thead>
            <tbody>{data.players.map((player) => <tr key={player.id}>
              <td><strong>{player.name}</strong></td>
              <td>{player.gender || "未知"}<br /><small>{player.birthDate || "未登记"}</small></td>
              <td>{player.wcaId || "—"}</td><td>{[player.province, player.city].filter(Boolean).join(" ") || "—"}</td>
              <td>{player.longCardProfile ? <small>提交：{player.longCardProfile.submittedAt || "—"}<br />电话：{phoneValue(player.longCardProfile)}<br />联系人：{player.longCardProfile.contactRelationship || "—"}<br />渠道：{player.longCardProfile.channel || "—"}<br />备注：{player.longCardProfile.notes || "—"}</small> : "—"}</td>
              <td>{player.status || "active"}</td><td>{player.resultCount}</td><td>{player.lastCompetedAt ? new Date(player.lastCompetedAt).toLocaleDateString("zh-CN") : "—"}</td>
              <td><button className="button compact" type="button" onClick={() => openEdit(player)}><Pencil size={14} />编辑</button></td>
            </tr>)}</tbody>
          </table>
        </div>
        {data.players.length === 0 ? <p className="empty-state">没有符合条件的选手。</p> : null}
        <div className="weekly-admin-actions"><span>共 {data.total} 名，第 {data.page}/{pageCount} 页</span><button className="button" type="button" disabled={data.page <= 1} onClick={() => load(data.page - 1)}>上一页</button><button className="button" type="button" disabled={data.page >= pageCount} onClick={() => load(data.page + 1)}>下一页</button></div>
      </div>
      {editor ? <div className="weekly-admin-login-backdrop" role="presentation"><form className="weekly-admin-login-modal" onSubmit={save}>
        <div className="admin-card-heading"><h2>{title}</h2><button className="button compact" type="button" onClick={() => setEditor(null)}>取消</button></div>
        <div className="weekly-admin-grid">
          <label className="full">姓名 *<input required value={editor.form.name} onChange={(event) => setField("name", event.target.value)} /></label>
          <label>性别<select value={editor.form.gender} onChange={(event) => setField("gender", event.target.value as PlayerForm["gender"])}><option value="">未知</option><option value="男">男</option><option value="女">女</option></select></label>
          <label>出生日期（仅后台）<input type="date" value={editor.form.birthDate} onChange={(event) => setField("birthDate", event.target.value)} /></label>
          <label>WCA ID<input value={editor.form.wcaId} onChange={(event) => setField("wcaId", event.target.value)} /></label>
          <label>省份<input value={editor.form.province} onChange={(event) => setField("province", event.target.value)} /></label>
          <label>城市<input value={editor.form.city} onChange={(event) => setField("city", event.target.value)} /></label>
          <label>状态<select value={editor.form.status} onChange={(event) => setField("status", event.target.value as PlayerForm["status"])}><option value="active">active</option><option value="inactive">inactive</option></select></label>
          {editor.form.status === "inactive" ? <label className="full">停用原因<input required value={editor.form.deactivationReason} onChange={(event) => setField("deactivationReason", event.target.value)} /></label> : null}
          <label className="full">管理员备注<textarea rows={3} value={editor.form.notes} onChange={(event) => setField("notes", event.target.value)} /></label>
          {editor.mode === "create" && editor.confirmSameName ? <label className="full"><input type="checkbox" checked={editor.confirmSameName} onChange={(event) => setEditor((current) => current ? { ...current, confirmSameName: event.target.checked } : null)} /> 我确认这是与现有同名选手不同的人，仍要新建。</label> : null}
        </div>
        <div className="weekly-admin-login-actions"><button className="button primary" disabled={saving} type="submit"><Plus size={16} />{saving ? "保存中" : "保存"}</button></div>
      </form></div> : null}
      {longCardEditor ? <div className="weekly-admin-login-backdrop" role="presentation"><form className="weekly-admin-login-modal" onSubmit={saveLongCard}>
        <div className="admin-card-heading"><h2>编辑长期卡学员信息</h2><button className="button compact" type="button" onClick={() => setLongCardEditor(null)}>取消</button></div>
        <div className="weekly-admin-grid">
          <label>提交日期<input type="date" value={longCardEditor.form.submittedAt} onChange={(event) => setLongCardField("submittedAt", event.target.value)} /></label>
          <label>姓名<input value={longCardEditor.form.name} onChange={(event) => setLongCardField("name", event.target.value)} /></label>
          <label>性别<select value={longCardEditor.form.gender} onChange={(event) => setLongCardField("gender", event.target.value as LongCardForm["gender"])}><option value="">未知</option><option value="男">男</option><option value="女">女</option></select></label>
          <label>出生日期<input type="date" value={longCardEditor.form.birthDate} onChange={(event) => setLongCardField("birthDate", event.target.value)} /></label>
          <label>联系电话<input type="tel" value={longCardEditor.form.phone} onChange={(event) => setLongCardField("phone", event.target.value)} /></label>
          <label>联系人所属关系<input value={longCardEditor.form.contactRelationship} onChange={(event) => setLongCardField("contactRelationship", event.target.value)} /></label>
          <label>渠道<input value={longCardEditor.form.channel} onChange={(event) => setLongCardField("channel", event.target.value)} /></label>
          <label>WCA ID<input value={longCardEditor.form.wcaId} onChange={(event) => setLongCardField("wcaId", event.target.value)} /></label>
          <label className="full">备注<textarea rows={3} value={longCardEditor.form.notes} onChange={(event) => setLongCardField("notes", event.target.value)} /></label>
        </div>
        <div className="weekly-admin-login-actions"><button className="button primary" disabled={saving} type="submit"><Pencil size={16} />{saving ? "保存中" : "保存"}</button></div>
      </form></div> : null}
    </section>
  );
}

function dateOnly(value: string) {
  const match = value.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function ageGroup(birthDate: string) {
  const normalized = dateOnly(birthDate);
  if (!normalized) return "—";
  const [year, month, day] = normalized.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  if (age < 0) return "—";
  if (age < 6) return "U6";
  if (age < 8) return "U8";
  if (age < 10) return "U10";
  if (age < 12) return "U12";
  if (age < 18) return "U18";
  return "成人组";
}
