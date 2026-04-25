import { CompetitionCard } from "@/components/cards";
import { PageHero } from "@/components/page-hero";
import { competitions } from "@/lib/data";

export default function CompetitionsPage() {
  return (
    <>
      <PageHero label="赛事与活动" title="赛事活动列表">
        这里既可以记录 WCA 赛事，也可以记录集训、推广、外出交流等非比赛类战队活动。
      </PageHero>
      <section className="container section">
        <div className="grid two">
          {competitions.map((competition) => (
            <CompetitionCard competition={competition} key={competition.id} />
          ))}
        </div>
      </section>
    </>
  );
}
