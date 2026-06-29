"use client";

import { ExternalLink, X } from "lucide-react";
import { useState } from "react";
import { type EditableCommercialTeam } from "@/lib/commercial-team-store";
import { type Person } from "@/lib/data";

type Props = {
  initialTeams: EditableCommercialTeam[];
  teamOptions: string[];
  wcaNameEntries: [string, string][];
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

export function CommercialTeamsClient({ initialTeams, teamOptions, wcaNameEntries }: Props) {
  const wcaNames = new Map(wcaNameEntries);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [draft, setDraft] = useState<SubmissionDraft>({
    ...emptySubmissionDraft,
    teamName: teamOptions[0] || ""
  });
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateDraft(patch: Partial<SubmissionDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function submitProfile() {
    setIsSubmitting(true);
    setStatus("提交中...");
    try {
      const response = await fetch("/api/commercial-profile-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "提交失败。");
      setStatus("已提交，管理员审核后会更新展示。");
      setDraft({ ...emptySubmissionDraft, teamName: teamOptions[0] || "" });
      setIsFormOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "提交失败，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="commercial-submission-panel">
        <div>
          <strong>成员简介补充</strong>
          <span>选手、家长或老师可以提交简介，审核通过后再展示。</span>
        </div>
        <button className="button primary" type="button" onClick={() => setIsFormOpen(true)}>
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
                <span>联系方式仅用于后台核对，前台不会展示。</span>
              </div>
              <button className="icon-button" type="button" onClick={() => setIsFormOpen(false)} aria-label="关闭">
                <X size={16} />
              </button>
            </div>
            <div className="commercial-submission-form">
              <label>
                选手姓名
                <input value={draft.playerName} onChange={(event) => updateDraft({ playerName: event.target.value })} />
              </label>
              <label>
                所属战队
                <select value={draft.teamName} onChange={(event) => updateDraft({ teamName: event.target.value })}>
                  {teamOptions.map((teamName) => (
                    <option key={teamName} value={teamName}>
                      {teamName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                城市
                <input value={draft.city} onChange={(event) => updateDraft({ city: event.target.value })} placeholder="如：沈阳" />
              </label>
              <label>
                WCA ID
                <input value={draft.wcaId} onChange={(event) => updateDraft({ wcaId: event.target.value })} placeholder="可选" />
              </label>
              <label>
                主项
                <input value={draft.mainEvent} onChange={(event) => updateDraft({ mainEvent: event.target.value })} placeholder="如：三阶速拧" />
              </label>
              <label>
                提交人身份
                <select value={draft.submitterRole} onChange={(event) => updateDraft({ submitterRole: event.target.value })}>
                  <option value="">请选择</option>
                  <option value="选手本人">选手本人</option>
                  <option value="家长">家长</option>
                  <option value="老师/教练">老师/教练</option>
                  <option value="战队管理员">战队管理员</option>
                  <option value="其他">其他</option>
                </select>
              </label>
              <label className="commercial-submission-wide">
                联系方式
                <input value={draft.contact} onChange={(event) => updateDraft({ contact: event.target.value })} placeholder="微信、手机号或邮箱，仅后台可见" />
              </label>
              <label className="commercial-submission-wide">
                简介内容
                <textarea value={draft.bio} onChange={(event) => updateDraft({ bio: event.target.value })} placeholder="建议包含主项、代表成绩、战队身份等。涉及未成年人时请确认已获监护人同意。" />
              </label>
              <label className="commercial-submission-wide">
                备注
                <textarea value={draft.note} onChange={(event) => updateDraft({ note: event.target.value })} placeholder="可填写证明链接、需要更正的原简介等，选填。" />
              </label>
            </div>
            <div className="commercial-submission-actions">
              <button className="button button--ghost" type="button" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>
                取消
              </button>
              <button className="button primary" type="button" onClick={submitProfile} disabled={isSubmitting}>
                {isSubmitting ? "提交中" : "提交审核"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="commercial-teams-list">
        {initialTeams.map((team) => (
          <TeamSection key={team.id} team={team} wcaNames={wcaNames} />
        ))}
      </div>
    </>
  );
}

function TeamSection({
  team,
  wcaNames
}: {
  team: EditableCommercialTeam;
  wcaNames: Map<string, string>;
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
          <MemberCard key={member.id} member={member} wcaName={member.wcaId ? wcaNames.get(member.wcaId) : undefined} />
        ))}
      </div>
    </div>
  );
}

function getTeamLogo(teamId: string) {
  switch (teamId) {
    case "gan-gurus":
      return { mark: "G", title: "GAN", caption: "GURUS" };
    case "speed-ace-linghang":
      return { mark: "S", title: "SPEED", caption: "ACE 领航" };
    case "speed-ace-qihang":
      return { mark: "S", title: "SPEED", caption: "ACE 启航" };
    case "mo-yu-team":
      return { mark: "M", title: "MoYu", caption: "TEAM" };
    case "meng-zhi-team":
      return { mark: "梦", title: "MoYu", caption: "DREAM" };
    case "future-stars-team":
      return { mark: "Q", title: "QiYi", caption: "STAR" };
    default:
      return { mark: "T", title: "TEAM", caption: "CUBING" };
  }
}

function MemberCard({ member, wcaName }: { member: Person; wcaName?: string }) {
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
              {member.mainEvent ? <span>{member.mainEvent}</span> : null}
            </span>
          </div>
          {cubingUrl ? (
            <a className="wca-id-badge" href={cubingUrl} referrerPolicy="no-referrer" target="_blank" rel="noopener noreferrer" title={wcaName}>
              <ExternalLink size={11} />
              {member.wcaId || "WCA"}
            </a>
          ) : member.wcaId ? (
            <span className="wca-id-badge" title={wcaName}>
              {member.wcaId}
            </span>
          ) : (
            <span className="wca-id-badge wca-id-badge--pending">待关联</span>
          )}
        </div>
        {member.bio && <p className="commercial-member-bio">{member.bio}</p>}
      </div>
    </div>
  );
}
