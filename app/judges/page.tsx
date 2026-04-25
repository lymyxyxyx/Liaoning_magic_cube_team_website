import { PersonCard } from "@/components/cards";
import { PageHero } from "@/components/page-hero";
import { getPeopleByRole } from "@/lib/data";

export default function JudgesPage() {
  const judges = getPeopleByRole("裁判员");

  return (
    <>
      <PageHero label="人员档案" title="裁判员列表">
        沉淀裁判员执裁经历、规则宣讲和赛事参与记录，让省内赛事资料更容易维护。
      </PageHero>
      <section className="container section">
        <div className="grid">
          {judges.map((person) => (
            <PersonCard person={person} key={person.id} />
          ))}
        </div>
      </section>
    </>
  );
}
