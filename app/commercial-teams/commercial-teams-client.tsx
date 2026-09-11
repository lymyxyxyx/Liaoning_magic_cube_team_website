"use client";

import { ExternalLink, X } from "lucide-react";
import { useState } from "react";
import { type EditableCommercialTeam } from "@/lib/commercial-team-store";
import { type Person } from "@/lib/data";

type Props = {
  initialTeams: EditableCommercialTeam[];
  teamOptions: string[];
  wcaNameEntries: [string, string][];
  isAdmin: boolean;
};

type SubmissionDraft = {
  playerName: string;
  teamName: string;
  city: string;
  wcaId: string;
  mainEvent: string;
  bio: string;
  submitterRole: string;
  contact: string;
  note: string;
};

type MemberDraft = {
  name: string;
  gender: "男" | "女" | "";
  city: string;
  wcaId: string;
  mainEvent: string;
  bio: string;
  specialties: string;
};

const emptyMemberDraft: MemberDraft = { name: "", gender: "", city: "沈阳", wcaId: "", mainEvent: "", bio: "", specialties: "" };

const emptySubmissionDraft: SubmissionDraft = {
  playerName: "",
  teamName: "",
  city: "",
  wcaId: "",
  mainEvent: "",
  bio: "",
  submitterRole: "",
  contact: "",
  note: ""
};

export function CommercialTeamsClient({ initialTeams, teamOptions, wcaNameEntries, isAdmin: initialIsAdmin }: Props) {
  const wcaNames = new Map(wcaNameEntries);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [draft, setDraft] = useState<SubmissionDraft>({ ...emptySubmissionDraft, teamName: teamOptions[0] || "" });
  const [status, setStatus] = useState("");
  const [dialogStatus, setDialogStatus] = useState("");
  const [submissionSucceeded, setSubmissionSucceeded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoginStatus, setAdminLoginStatus] = useState("");
  const [adminLoggingIn, setAdminLoggingIn] = useState(false);

  const [memberDialog, setMemberDialog] = useState<"edit" | "create" | null>(null);
  const [memberDraft, setMemberDraft] = useState<MemberDraft>(emptyMemberDraft);
  const [memberTeamId, setMemberTeamId] = useState("");
  const [memberTargetId, setMemberTargetId] = useState("");
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberDialogStatus, setMemberDialogStatus] = useState("");

  function updateDraft(patch: Partial<SubmissionDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setDialogStatus("");
  }

  async function adminLogin() {
    if (!adminPassword.trim()) return;
    setAdminLoggingIn(true);
    setAdminLoginStatus("");
    try {
      const response = await fetch("/api/commercial-admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string };
        throw new Error(payload?.message || "登录失败");
      }
      setIsAdmin(true);
      setAdminPassword("");
    } catch (error) {
      setAdminLoginStatus(error instanceof Error ? error.message : "登录失败");
    } finally {
      setAdminLoggingIn(false);
    }
  }

  function openEditMember(teamId: string, member: Person) {
    setMemberDialog("edit");
    setMemberTeamId(teamId);
    setMemberTargetId(member.id);
    setMemberDraft({
      name: member.name,
      gender: member.gender || "",
      city: member.city || "",
      wcaId: member.wcaId || "",
      mainEvent: member.mainEvent || "",
      bio: member.bio || "",
      specialties: (member.specialties || []).join("、")
    });
    setMemberDialogStatus("");
  }

  function openCreateMember(teamId: string) {
    setMemberDialog("create");
    setMemberTeamId(teamId);
    setMemberTargetId("");
    setMemberDraft({ ...emptyMemberDraft });
    setMemberDialogStatus("");
  }

  async function saveMember() {
    setMemberSaving(true);
    setMemberDialogStatus("保存中...");
    try {
      const specialties = memberDraft.specialties.split(/[、,，]/).map((s) => s.trim()).filter(Boolean);
      const body = {
        teamId: memberTeamId,
        ...(memberDialog === "edit" ? { memberId: memberTargetId } : {}),
        name: memberDraft.name,
        gender: memberDraft.gender || undefined,
        city: memberDraft.city,
        wcaId: memberDraft.wcaId,
        mainEvent: memberDraft.mainEvent,
        bio: memberDraft.bio,
        specialties
      };
      const response = await fetch("/api/commercial-admin-specialties", {
        method: memberDialog === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string };
        throw new Error(payload?.message || "保存失败");
      }
      setMemberDialog(null);
      window.location.reload();
    } catch (error) {
      setMemberDialogStatus(error instanceof Error ? error.message : "保存失败");
    } finally {
      setMemberSaving(false);
    }
  }

  async function submitProfile() {
    if (!draft.playerName.trim() || !draft.bio.trim()) {
      setDialogStatus("请填写选手姓名和简介内容。");
      return;
    }
    setIsSubmitting(true);
    setDialogStatus("提交中...");
    try {
      const response = await fetch("/api/commercial-profile-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "提交失败。");
      setStatus("已提交，管理员审核后会更新展示。");
      setDialogStatus("");
      setSubmissionSucceeded(true);
      setDraft({ ...emptySubmissionDraft, teamName: teamOptions[0] || "" });
    } catch (error) {
      setDialogStatus(error instanceof Error ? error.message : "提交失败，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {isAdmin ? (
        <div className="weekly-admin-lock-panel" style={{ marginBottom: 16 }}>
          <strong>管理员模式</strong>
          <span>可以编辑成员信息和新建成员。</span>
          <form action="/api/commercial-admin-logout" method="post"><button className="button" type="submit">退出管理</button></form>
        </div>
      ) : (
        <div className="weekly-admin-lock-panel" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong>管理员入口</strong>
          <input type="password" placeholder="管理员密码" value={adminPassword} onChange={(e) => { setAdminPassword(e.target.value); setAdminLoginStatus(""); }} onKeyDown={(e) => { if (e.key === "Enter") adminLogin(); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--line)" }} />
          <button className="button" type="button" onClick={adminLogin} disabled={adminLoggingIn || !adminPassword.trim()}>{adminLoggingIn ? "登录中..." : "登录"}</button>
          {adminLoginStatus ? <span style={{ color: "var(--red)" }}>{adminLoginStatus}</span> : null}
        </div>
      )}

      <div className="commercial-submission-panel">
        <div>
          <strong>成员简介补充</strong>
          <span>选手、家长或老师可以提交简介，审核通过后再展示。</span>
        </div>
        <button className="button primary" type="button" onClick={() => { setDialogStatus(""); setSubmissionSucceeded(false); setIsFormOpen(true); }}>
          提交成员简介
        </button>
      </div>
      {status ? <p className="commercial-submission-status">{status}</p> : null}

      {isFormOpen ? (
        <div className="commercial-submission-backdrop" role="presentation">
          <div className="commercial-submission-dialog" role="dialog" aria-modal="true" aria-label="提交成员简介">
            <div className="commercial-submission-dialog-head">
              <div>
                <strong>提交成员简介</strong>
                <span>只需填写选手姓名和简介内容，其他信息可选；联系方式仅后台可见。</span>
              </div>
              <button className="icon-button" type="button" onClick={() => { setIsFormOpen(false); setDialogStatus(""); setSubmissionSucceeded(false); }} aria-label="关闭"><X size={16} /></button>
            </div>
            {submissionSucceeded ? (
              <div className="commercial-submission-success" role="status">
                <strong>提交成功</strong>
                <span>信息已经进入后台待审核列表，管理员审核后会更新展示。</span>
                <button className="button primary" type="button" onClick={() => { setIsFormOpen(false); setSubmissionSucceeded(false); }}>知道了</button>
              </div>
            ) : (
              <>
                <div className="commercial-submission-form">
                  <label>选手姓名 <em>必填</em><input value={draft.playerName} onChange={(event) => updateDraft({ playerName: event.target.value })} /></label>
                  <label>所属战队<select value={draft.teamName} onChange={(event) => updateDraft({ teamName: event.target.value })}><option value="">不确定 / 暂不填写</option>{teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
                  <label>城市<input value={draft.city} onChange={(event) => updateDraft({ city: event.target.value })} placeholder="如：沈阳，选填" /></label>
                  <label>WCA ID<input value={draft.wcaId} onChange={(event) => updateDraft({ wcaId: event.target.value })} placeholder="选填" /></label>
                  <label>主项<input value={draft.mainEvent} onChange={(event) => updateDraft({ mainEvent: event.target.value })} placeholder="如：三阶速拧，选填" /></label>
                  <label>提交人身份<select value={draft.submitterRole} onChange={(event) => updateDraft({ submitterRole: event.target.value })}><option value="">选填</option><option value="选手本人">选手本人</option><option value="家长">家长</option><option value="老师/教练">老师/教练</option><option value="战队管理员">战队管理员</option><option value="其他">其他</option></select></label>
                  <label className="commercial-submission-wide">联系方式<input value={draft.contact} onChange={(event) => updateDraft({ contact: event.target.value })} placeholder="微信、手机号或邮箱，选填，仅后台可见" /></label>
                  <label className="commercial-submission-wide">简介内容 <em>必填</em><textarea value={draft.bio} onChange={(event) => updateDraft({ bio: event.target.value })} placeholder="建议包含主项、代表成绩、战队身份等。涉及未成年人时请确认已获监护人同意。" /></label>
                  <label className="commercial-submission-wide">备注<textarea value={draft.note} onChange={(event) => updateDraft({ note: event.target.value })} placeholder="可填写证明链接、需要更正的原简介等，选填。" /></label>
                </div>
                {dialogStatus ? <p className="commercial-submission-dialog-status" role="alert">{dialogStatus}</p> : null}
                <div className="commercial-submission-actions">
                  <button className="button button--ghost" type="button" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>取消</button>
                  <button className="button primary" type="button" onClick={submitProfile} disabled={isSubmitting}>{isSubmitting ? "提交中" : "提交审核"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="commercial-teams-list">
        {initialTeams.map((team) => (
          <TeamSection key={team.id} team={team} wcaNames={wcaNames} isAdmin={isAdmin} onEdit={openEditMember} onCreate={openCreateMember} />
        ))}
      </div>

      {memberDialog ? (
        <div className="commercial-submission-backdrop" role="presentation" onClick={() => setMemberDialog(null)}>
          <div className="commercial-submission-dialog" role="dialog" aria-modal="true" aria-label={memberDialog === "edit" ? "编辑成员" : "新建成员"} onClick={(e) => e.stopPropagation()}>
            <div className="commercial-submission-dialog-head">
              <div><strong>{memberDialog === "edit" ? "编辑成员" : "新建成员"}</strong><span>顿号分隔多个标签</span></div>
              <button className="icon-button" type="button" onClick={() => setMemberDialog(null)} aria-label="关闭"><X size={16} /></button>
            </div>
            <div className="commercial-submission-form">
              <label>姓名 <em>必填</em><input value={memberDraft.name} onChange={(e) => setMemberDraft((d) => ({ ...d, name: e.target.value }))} /></label>
              <label>性别<select value={memberDraft.gender} onChange={(e) => setMemberDraft((d) => ({ ...d, gender: e.target.value as "男" | "女" | "" }))}><option value="">未填</option><option value="男">男</option><option value="女">女</option></select></label>
              <label>城市<input value={memberDraft.city} onChange={(e) => setMemberDraft((d) => ({ ...d, city: e.target.value }))} /></label>
              <label>WCA ID<input value={memberDraft.wcaId} onChange={(e) => setMemberDraft((d) => ({ ...d, wcaId: e.target.value }))} placeholder="选填" /></label>
              <label>主项<input value={memberDraft.mainEvent} onChange={(e) => setMemberDraft((d) => ({ ...d, mainEvent: e.target.value }))} placeholder="如：三阶速拧" /></label>
              <label className="commercial-submission-wide">简介<textarea value={memberDraft.bio} onChange={(e) => setMemberDraft((d) => ({ ...d, bio: e.target.value }))} placeholder="选手简介" /></label>
              <label className="commercial-submission-wide">标签（顿号分隔）<input value={memberDraft.specialties} onChange={(e) => setMemberDraft((d) => ({ ...d, specialties: e.target.value }))} placeholder="如：三阶速拧、枫叶" /></label>
            </div>
            {memberDialogStatus ? <p className="commercial-submission-dialog-status" role="alert">{memberDialogStatus}</p> : null}
            <div className="commercial-submission-actions">
              <button className="button button--ghost" type="button" onClick={() => setMemberDialog(null)} disabled={memberSaving}>取消</button>
              <button className="button primary" type="button" onClick={saveMember} disabled={memberSaving || !memberDraft.name.trim()}>{memberSaving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TeamSection({ team, wcaNames, isAdmin, onEdit, onCreate }: {
  team: EditableCommercialTeam;
  wcaNames: Map<string, string>;
  isAdmin: boolean;
  onEdit: (teamId: string, member: Person) => void;
  onCreate: (teamId: string) => void;
}) {
  const wcaCount = team.members.filter((m) => m.wcaId).length;
  const cityCount = new Set(team.members.map((member) => member.city).filter(Boolean)).size;
  const themeClass = `commercial-team-block--${team.id}`;
  const logo = getTeamLogo(team.id);

  return (
    <div className={`commercial-team-block ${themeClass}`}>
      <div className="commercial-team-header">
        <div className="commercial-team-title">
          {team.sponsor && <span className="eyebrow">{team.sponsor}</span>}
          <h2>{team.name}</h2>
          <div className="commercial-team-stats">
            <span>{team.members.length} 名成员</span>
            <span>{cityCount || 1} 个城市</span>
            {wcaCount > 0 ? <span className="wca-count">{wcaCount} 人已关联 WCA</span> : null}
          </div>
        </div>
        <div className="commercial-team-logo" aria-label={`${team.name} 标识`}>
          <span className="commercial-team-logo-mark">{logo.mark}</span>
          <span className="commercial-team-logo-text">
            <strong>{logo.title}</strong>
            <small>{logo.caption}</small>
          </span>
        </div>
      </div>
      {team.description && <p className="commercial-team-description">{team.description}</p>}
      <div className="commercial-member-grid">
        {team.members.map((member) => (
          <MemberCard key={member.id} member={member} wcaName={member.wcaId ? wcaNames.get(member.wcaId) : undefined} isAdmin={isAdmin} teamId={team.id} onEdit={onEdit} />
        ))}
        {isAdmin ? (
          <div className="commercial-member-link">
            <button className="commercial-member-card" type="button" onClick={() => onCreate(team.id)} style={{ cursor: "pointer", border: "2px dashed var(--muted)", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120, color: "var(--muted)", fontSize: 14 }}>
              + 新建成员
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getTeamLogo(teamId: string) {
  switch (teamId) {
    case "gan-gurus": return { mark: "G", title: "GAN", caption: "GURUS" };
    case "speed-ace-linghang": return { mark: "S", title: "SPEED", caption: "ACE 领航" };
    case "speed-ace-qihang": return { mark: "S", title: "SPEED", caption: "ACE 启航" };
    case "mo-yu-team": return { mark: "M", title: "MoYu", caption: "TEAM" };
    case "meng-zhi-team": return { mark: "梦", title: "MoYu", caption: "DREAM" };
    case "future-stars-team": return { mark: "Q", title: "QiYi", caption: "STAR" };
    default: return { mark: "T", title: "TEAM", caption: "CUBING" };
  }
}

function MemberCard({ member, wcaName, isAdmin, teamId, onEdit }: { member: Person; wcaName?: string; isAdmin: boolean; teamId: string; onEdit: (teamId: string, member: Person) => void }) {
  const cubingUrl = member.wcaId ? `https://cubing.com/results/person/${member.wcaId}` : member.wcaUrl;

  return (
    <div className="commercial-member-link">
      <div className="commercial-member-card">
        <div className="commercial-member-top">
          <div className="commercial-member-main">
            <strong>{member.name}</strong>
            <span className="commercial-member-meta">
              <span>{member.gender || "未填性别"}</span>
              <span>{member.city}</span>
            </span>
          </div>
          {cubingUrl ? (
            <a className="wca-id-badge" href={cubingUrl} referrerPolicy="no-referrer" target="_blank" rel="noopener noreferrer" title={wcaName}>
              <ExternalLink size={11} />
              {member.wcaId || "WCA"}
            </a>
          ) : member.wcaId ? (
            <span className="wca-id-badge" title={wcaName}>{member.wcaId}</span>
          ) : (
            <span className="wca-id-badge wca-id-badge--pending">待关联</span>
          )}
        </div>
        {member.bio && <p className="commercial-member-bio">{member.bio}</p>}
        {member.specialties && member.specialties.length > 0 && (
          <div className="commercial-member-tags">
            {member.specialties.map((tag) => (
              <span key={tag} className="commercial-member-tag">{tag}</span>
            ))}
          </div>
        )}
        {isAdmin ? (
          <button className="button" type="button" onClick={() => onEdit(teamId, member)} style={{ marginTop: 8, fontSize: 12, padding: "4px 10px" }}>
            编辑
          </button>
        ) : null}
      </div>
    </div>
  );
}
