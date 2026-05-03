import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { commercialTeams, type CommercialTeam } from "@/lib/commercial-teams";
import { type Person } from "@/lib/data";
import { getPostgresPool } from "@/lib/postgres";

export const dynamic = "force-dynamic";

async function getWcaNames(wcaIds: string[]): Promise<Map<string, string>> {
  if (wcaIds.length === 0) return new Map();
  try {
    const { rows } = await getPostgresPool().query<{ wca_id: string; name: string }>(
      "SELECT wca_id, name FROM wca_persons WHERE wca_id = ANY($1::text[]) AND sub_id = '1'",
      [wcaIds]
    );
    return new Map(rows.map((r) => [r.wca_id, r.name]));
  } catch {
    return new Map();
  }
}

function MemberCard({ member, wcaName }: { member: Person; wcaName?: string }) {
  const content = (
    <div className="commercial-member-card">
      <div className="commercial-member-main">
        <strong>{member.name}</strong>
        <span className="commercial-member-meta">
          {member.gender} · {member.city}
        </span>
      </div>
      {member.wcaId ? (
        <span className="wca-id-badge" title={wcaName}>
          <ExternalLink size={11} />
          {member.wcaId}
        </span>
      ) : (
        <span className="wca-id-badge wca-id-badge--pending">待关联</span>
      )}
    </div>
  );

  if (member.wcaUrl) {
    return (
      <a className="commercial-member-link" href={member.wcaUrl} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }
  return <div className="commercial-member-link">{content}</div>;
}

function TeamSection({ team, wcaNames }: { team: CommercialTeam; wcaNames: Map<string, string> }) {
  const wcaCount = team.members.filter((m) => m.wcaId).length;

  return (
    <div className="commercial-team-block">
      <div className="commercial-team-header">
        <div>
          {team.sponsor && <span className="eyebrow">{team.sponsor}</span>}
          <h2>{team.name}</h2>
          <p className="commercial-team-stats">
            {team.members.length} 名辽宁成员
            {wcaCount > 0 && (
              <span className="wca-count"> · {wcaCount} 人已关联 WCA</span>
            )}
          </p>
        </div>
        {team.brandUrl && (
          <a className="button button--ghost" href={team.brandUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} />
            品牌官网
          </a>
        )}
      </div>

      {team.description && (
        <p className="commercial-team-description">{team.description}</p>
      )}

      <div className="commercial-member-grid">
        {team.members.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            wcaName={member.wcaId ? wcaNames.get(member.wcaId) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export default async function CommercialTeamsPage() {
  const allWcaIds = commercialTeams
    .flatMap((t) => t.members)
    .map((m) => m.wcaId)
    .filter((id): id is string => Boolean(id));

  const wcaNames = await getWcaNames([...new Set(allWcaIds)]);

  return (
    <>
      <PageHero label="商业战队" title="辽宁魔方少儿战队商业合作">
        展示与战队合作的各大商业战队和社团，包括成员档案、WCA 关联和发展动态。
      </PageHero>

      <section className="container section">
        <div className="commercial-teams-list">
          {commercialTeams.map((team) => (
            <TeamSection key={team.id} team={team} wcaNames={wcaNames} />
          ))}
        </div>
      </section>
    </>
  );
}
