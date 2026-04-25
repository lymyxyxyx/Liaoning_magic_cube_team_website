import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { AchievementBadge, RoleTags } from "@/components/cards";
import {
  achievements,
  competitions,
  getAchievementPerson,
  getCompetitionBySlug,
  getCompetitionPeople
} from "@/lib/data";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return competitions.map((competition) => ({ slug: competition.slug }));
}

export default function CompetitionDetailPage({ params }: { params: { slug: string } }) {
  const competition = getCompetitionBySlug(params.slug);

  if (!competition) {
    notFound();
  }

  const relatedPeople = getCompetitionPeople(competition.id);
  const relatedAchievements = achievements.filter((achievement) => achievement.competitionId === competition.id);

  return (
    <section className="container section">
      <Image className="event-cover" src={competition.cover} alt={`${competition.name}封面`} width={1160} height={652} />
      <div className="detail-layout" style={{ marginTop: 22 }}>
        <aside className="profile-panel">
          <span className="eyebrow">赛事活动</span>
          <h1>{competition.name}</h1>
          <div className="tag-row">
            {competition.tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
            <span className={`status status-${competition.completeness}`}>{competition.status}</span>
          </div>
          <dl className="definition-list">
            <div>
              <dt>举办时间</dt>
              <dd>{competition.date}</dd>
            </div>
            <div>
              <dt>城市</dt>
              <dd>{competition.city}</dd>
            </div>
            <div>
              <dt>场馆</dt>
              <dd>{competition.venue}</dd>
            </div>
            <div>
              <dt>完整度</dt>
              <dd>{competition.completeness}</dd>
            </div>
          </dl>
          <p className="meta-line" style={{ marginTop: 18 }}>
            <MapPin size={15} />
            {competition.address}
          </p>
        </aside>

        <div className="detail-main">
          <div className="info-block">
            <h2>赛事简介</h2>
            <p>{competition.description}</p>
          </div>

          <div className="info-block">
            <h2>相关人员</h2>
            <div className="timeline">
              {relatedPeople.map((item) =>
                item.person ? (
                  <Link className="timeline-item" href={`/people/${item.person.slug}`} key={`${item.personId}-${item.type}`}>
                    <strong>{item.person.name}</strong>
                    <span>
                      {item.type} · <RoleTags roles={item.person.roles} /> · {item.note || "备注待补充"}
                    </span>
                  </Link>
                ) : null
              )}
            </div>
          </div>

          <div className="info-block">
            <h2>相关荣誉</h2>
            <div className="grid two">
              {relatedAchievements.length > 0 ? (
                relatedAchievements.map((achievement) => {
                  const person = getAchievementPerson(achievement);
                  return (
                    <AchievementBadge
                      description={`${person?.name || "相关人员"} · ${achievement.description}`}
                      key={achievement.id}
                      title={achievement.title}
                      type={achievement.type}
                    />
                  );
                })
              ) : (
                <p>暂无公开荣誉记录，后续可继续补充。</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
