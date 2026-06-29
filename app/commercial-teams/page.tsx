import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { CommercialTeamsClient } from "@/app/commercial-teams/commercial-teams-client";
import { readCommercialTeams } from "@/lib/commercial-team-store";
import { getPostgresPool } from "@/lib/postgres";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "战队成员",
  description: "GAN、魔域、魔方格等魔方战队的辽宁成员名录与所属战队信息。",
  alternates: { canonical: "/commercial-teams" },
  openGraph: {
    type: "website",
    url: "/commercial-teams",
    title: "战队成员",
    description: "魔方战队的辽宁成员名录。"
  }
};

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
  const publicTeams = teams.map(({ brandUrl, ...team }) => team);
  const allWcaIds = teams
    .flatMap((t) => t.members)
    .map((m) => m.wcaId)
    .filter((id): id is string => Boolean(id));

  const wcaNames = await getWcaNames([...new Set(allWcaIds)]);

  return (
    <>
      <PageHero label="战队成员" title="辽宁魔方战队成员">
        辽宁选手战队与青少年梯队信息。
      </PageHero>

      <section className="container section">
        <CommercialTeamsClient
          initialTeams={publicTeams}
          teamOptions={publicTeams.map((team) => team.name)}
          wcaNameEntries={[...wcaNames.entries()]}
        />
      </section>
    </>
  );
}
