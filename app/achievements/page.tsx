import Link from "next/link";
import { AchievementBadge } from "@/components/cards";
import { PageHero } from "@/components/page-hero";
import { achievements, getAchievementCompetition, getAchievementPerson } from "@/lib/data";

export default function AchievementsPage() {
  return (
    <>
      <PageHero label="荣誉与勋章" title="荣誉档案">
        人工维护世界纪录、全国冠军、赛事冠军、优秀裁判员、优秀教练员和重要活动贡献等荣誉。
      </PageHero>
      <section className="container section">
        <div className="grid">
          {achievements.map((achievement) => {
            const person = getAchievementPerson(achievement);
            const competition = getAchievementCompetition(achievement);
            return (
              <Link href={person ? `/people/${person.slug}` : "/achievements"} key={achievement.id}>
                <AchievementBadge
                  description={`${achievement.year} · ${person?.name || "相关人员"}${competition ? ` · ${competition.name}` : ""}。${achievement.description}`}
                  title={achievement.title}
                  type={achievement.type}
                />
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
