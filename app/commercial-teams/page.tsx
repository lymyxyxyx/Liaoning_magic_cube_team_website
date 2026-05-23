import { PageHero } from "@/components/page-hero";
import { CommercialTeamsClient } from "@/app/commercial-teams/commercial-teams-client";
import { readCommercialTeams } from "@/lib/commercial-team-store";
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

export default async function CommercialTeamsPage() {
  const teams = await readCommercialTeams();
  const allWcaIds = teams
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
        <CommercialTeamsClient initialTeams={teams} wcaNameEntries={[...wcaNames.entries()]} />
      </section>
    </>
  );
}
