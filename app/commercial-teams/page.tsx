import { PageHero } from "@/components/page-hero";
import { PersonCard } from "@/components/cards";
import { commercialTeams } from "@/lib/commercial-teams";

export default function CommercialTeamsPage() {
  return (
    <>
      <PageHero label="商业战队" title="辽宁魔方少儿战队商业合作">
        展示与战队合作的各大商业战队和社团，包括成员档案、参赛经历和发展动态。
      </PageHero>

      <section className="container section">
        {commercialTeams.map((team) => (
          <div key={team.id} style={{ marginBottom: "60px" }}>
            <div className="section-header">
              <div>
                <h2>{team.name}</h2>
                <p>共 {team.members.length} 名成员</p>
              </div>
            </div>
            <div className="grid">
              {team.members.map((person) => (
                <PersonCard person={person} key={person.id} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
