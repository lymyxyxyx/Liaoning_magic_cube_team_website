"use client";

import { ExternalLink } from "lucide-react";
import { type EditableCommercialTeam } from "@/lib/commercial-team-store";
import { type Person } from "@/lib/data";

type Props = {
  initialTeams: EditableCommercialTeam[];
  wcaNameEntries: [string, string][];
};

export function CommercialTeamsClient({ initialTeams, wcaNameEntries }: Props) {
  const wcaNames = new Map(wcaNameEntries);

  return (
    <div className="commercial-teams-list">
      {initialTeams.map((team) => (
        <TeamSection key={team.id} team={team} wcaNames={wcaNames} />
      ))}
    </div>
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
