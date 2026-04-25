import { PersonCard } from "@/components/cards";
import { PageHero } from "@/components/page-hero";
import { getPeopleByRole } from "@/lib/data";

export default function CoachesPage() {
  const coaches = getPeopleByRole("教练员");

  return (
    <>
      <PageHero label="人员档案" title="教练员列表">
        记录战队老师、培训方向、赛事带队和集训活动，为后续课程体系资料沉淀打底。
      </PageHero>
      <section className="container section">
        <div className="grid">
          {coaches.map((person) => (
            <PersonCard person={person} key={person.id} />
          ))}
        </div>
      </section>
    </>
  );
}
