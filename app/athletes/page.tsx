import { PersonCard } from "@/components/cards";
import { PageHero } from "@/components/page-hero";
import { getPeopleByRole } from "@/lib/data";

export default function AthletesPage() {
  const athletes = getPeopleByRole("运动员");

  return (
    <>
      <PageHero label="人员档案" title="运动员列表">
        展示战队运动员的城市、主项、WCA 信息和相关赛事经历。历史成绩可在后续逐步补齐。
      </PageHero>
      <section className="container section">
        <div className="grid">
          {athletes.map((person) => (
            <PersonCard person={person} key={person.id} />
          ))}
        </div>
      </section>
    </>
  );
}
