"use client";

import { useState } from "react";
import { Check, Edit3, ExternalLink, Save, X } from "lucide-react";
import { type EditableCommercialTeam } from "@/lib/commercial-team-store";
import { type Person } from "@/lib/data";

type Props = {
  initialTeams: EditableCommercialTeam[];
  wcaNameEntries: [string, string][];
};

type EditingState = {
  teamId: string;
  memberId: string;
  draft: Person;
};

export function CommercialTeamsClient({ initialTeams, wcaNameEntries }: Props) {
  const [teams, setTeams] = useState(initialTeams);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const wcaNames = new Map(wcaNameEntries);

  function startEditing(teamId: string, member: Person) {
    setNotice("");
    setEditing({ teamId, memberId: member.id, draft: { ...member, roles: [...member.roles] } });
  }

  function updateDraft(patch: Partial<Person>) {
    setEditing((current) => (current ? { ...current, draft: { ...current.draft, ...patch } } : current));
  }

  async function saveMember() {
    if (!editing) return;
    if (!editing.draft.name.trim()) {
      setNotice("姓名不能为空。");
      return;
    }

    const nextTeams = teams.map((team) =>
      team.id === editing.teamId
        ? {
            ...team,
            members: team.members.map((member) =>
              member.id === editing.memberId
                ? normalizeDraft(editing.draft)
                : member
            )
          }
        : team
    );

    setIsSaving(true);
    setNotice("正在保存...");
    try {
      const response = await fetch("/api/commercial-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams: nextTeams })
      });
      if (!response.ok) throw new Error("save");
      const payload = (await response.json()) as { teams: EditableCommercialTeam[] };
      setTeams(payload.teams || nextTeams);
      setEditing(null);
      setNotice("已保存，其他人刷新页面后即可看到更新。");
    } catch {
      setNotice("保存失败，请稍后重试。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="commercial-edit-toolbar">
        <span>{notice || "成员资料可在本页快速维护。"}</span>
        {editing && (
          <button className="button button--ghost" type="button" onClick={() => setEditing(null)}>
            <X size={14} />
            取消编辑
          </button>
        )}
      </div>

      <div className="commercial-teams-list">
        {teams.map((team) => (
          <TeamSection
            key={team.id}
            team={team}
            editing={editing}
            isSaving={isSaving}
            wcaNames={wcaNames}
            onEdit={startEditing}
            onDraftChange={updateDraft}
            onSave={saveMember}
          />
        ))}
      </div>
    </>
  );
}

function TeamSection({
  team,
  editing,
  isSaving,
  wcaNames,
  onEdit,
  onDraftChange,
  onSave
}: {
  team: EditableCommercialTeam;
  editing: EditingState | null;
  isSaving: boolean;
  wcaNames: Map<string, string>;
  onEdit: (teamId: string, member: Person) => void;
  onDraftChange: (patch: Partial<Person>) => void;
  onSave: () => void;
}) {
  const wcaCount = team.members.filter((m) => m.wcaId).length;
  const cityCount = new Set(team.members.map((member) => member.city).filter(Boolean)).size;

  return (
    <div className="commercial-team-block">
      <div className="commercial-team-header">
        <div>
          {team.sponsor && <span className="eyebrow">{team.sponsor}</span>}
          <h2>{team.name}</h2>
          <div className="commercial-team-stats">
            <span>{team.members.length} 名成员</span>
            <span>{cityCount || 1} 个城市</span>
            {wcaCount > 0 ? <span className="wca-count">{wcaCount} 人已关联 WCA</span> : null}
          </div>
        </div>
        {team.brandUrl && (
          <a className="button button--ghost" href={team.brandUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} />
            品牌官网
          </a>
        )}
      </div>

      {team.description && <p className="commercial-team-description">{team.description}</p>}

      <div className="commercial-member-grid">
        {team.members.map((member) => {
          const isEditing = editing?.teamId === team.id && editing.memberId === member.id;
          return isEditing ? (
            <MemberEditor
              key={member.id}
              draft={editing.draft}
              isSaving={isSaving}
              onChange={onDraftChange}
              onSave={onSave}
            />
          ) : (
            <MemberCard
              key={member.id}
              member={member}
              wcaName={member.wcaId ? wcaNames.get(member.wcaId) : undefined}
              onEdit={() => onEdit(team.id, member)}
            />
          );
        })}
      </div>
    </div>
  );
}

function MemberCard({ member, wcaName, onEdit }: { member: Person; wcaName?: string; onEdit: () => void }) {
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
        <div className="commercial-member-actions">
          <button className="button button--ghost commercial-edit-button" type="button" onClick={onEdit}>
            <Edit3 size={14} />
            编辑
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberEditor({
  draft,
  isSaving,
  onChange,
  onSave
}: {
  draft: Person;
  isSaving: boolean;
  onChange: (patch: Partial<Person>) => void;
  onSave: () => void;
}) {
  return (
    <div className="commercial-member-link commercial-member-editor">
      <label>
        姓名
        <input value={draft.name} onChange={(event) => onChange({ name: event.target.value })} />
      </label>
      <label>
        性别
        <select
          value={draft.gender || ""}
          onChange={(event) => onChange({ gender: event.target.value === "男" || event.target.value === "女" ? event.target.value : undefined })}
        >
          <option value="">未填</option>
          <option value="男">男</option>
          <option value="女">女</option>
        </select>
      </label>
      <label>
        城市
        <input value={draft.city} onChange={(event) => onChange({ city: event.target.value })} />
      </label>
      <label>
        主项
        <input value={draft.mainEvent || ""} onChange={(event) => onChange({ mainEvent: event.target.value })} />
      </label>
      <label>
        WCA ID
        <input value={draft.wcaId || ""} onChange={(event) => onChange({ wcaId: event.target.value })} />
      </label>
      <label>
        WCA 链接
        <input value={draft.wcaUrl || ""} onChange={(event) => onChange({ wcaUrl: event.target.value })} />
      </label>
      <label className="commercial-editor-wide">
        简介
        <textarea value={draft.bio || ""} rows={4} onChange={(event) => onChange({ bio: event.target.value })} />
      </label>
      <button className="button commercial-editor-save" type="button" disabled={isSaving} onClick={onSave}>
        {isSaving ? <Check size={14} /> : <Save size={14} />}
        {isSaving ? "保存中" : "保存修改"}
      </button>
    </div>
  );
}

function normalizeDraft(draft: Person): Person {
  const wcaId = draft.wcaId?.trim().toUpperCase();
  return {
    ...draft,
    name: draft.name.trim(),
    city: draft.city.trim() || "沈阳",
    mainEvent: draft.mainEvent?.trim() || undefined,
    wcaId: wcaId || undefined,
    wcaUrl: draft.wcaUrl?.trim() || (wcaId ? `https://cubing.com/results/person/${wcaId}` : undefined),
    bio: draft.bio || ""
  };
}
