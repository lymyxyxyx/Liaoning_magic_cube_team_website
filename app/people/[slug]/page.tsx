import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AchievementBadge, RoleTags } from "@/components/cards";
import {
  getAchievementsForPerson,
  getCompetitionDisplayName,
  getPersonBySlug,
  getPersonCompetitions,
  people
} from "@/lib/data";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPostgresPool } from "@/lib/postgres";

async function getPersonProfile(slug: string) {
  const knownPerson = getPersonBySlug(slug);
  if (knownPerson) return knownPerson;

  const wcaId = slug.toUpperCase();
  if (!/^\d{4}[A-Z]{4}\d{2}$/.test(wcaId)) return null;

  try {
    const { rows } = await getPostgresPool().query<{ wca_id: string; name: string; country_id: string }>(
      "SELECT wca_id, name, country_id FROM wca_persons WHERE wca_id = $1 AND sub_id = '1' LIMIT 1",
      [wcaId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: `wca-${row.wca_id}`,
      slug: row.wca_id,
      name: row.name,
      avatar: "/visuals/avatar-lin.svg",
      roles: ["运动员"] as ["运动员"],
      city: row.country_id === "China" ? "中国" : row.country_id || "待补充",
      mainEvent: "WCA 竞速项目",
      wcaId: row.wca_id,
      wcaUrl: `https://www.worldcubeassociation.org/persons/${row.wca_id}`,
      bio: "该选手的站内个人资料正在整理中。你可以通过下方链接查看其官方成绩与比赛记录。",
      specialties: [],
      rankingNote: "暂无辽宁或城市归属排名",
      visible: true
    };
  } catch {
    return null;
  }
}

export function generateStaticParams() {
  return people.map((person) => ({ slug: person.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const person = getPersonBySlug(params.slug);
  if (!person) return { title: "未找到该人员" };

  const parts = [person.city, person.mainEvent, person.wcaId ? `WCA ID ${person.wcaId}` : ""].filter(Boolean);
  const description = (person.bio?.trim() || `${person.name}的辽宁魔方档案：${parts.join(" · ")}。`).slice(0, 150);
  const canonical = `/people/${person.slug}`;

  return {
    title: person.name,
    description,
    alternates: { canonical },
    openGraph: { type: "profile", url: canonical, title: person.name, description },
    twitter: { card: "summary_large_image", title: person.name, description }
  };
}

export default async function PersonDetailPage({ params }: { params: { slug: string } }) {
  const person = await getPersonProfile(params.slug);

  if (!person) {
    notFound();
  }

  const competitions = getPersonCompetitions(person.id);
  const achievements = getAchievementsForPerson(person.id);

  return (
    <section className="container section detail-layout">
      <aside className="profile-panel">
        <Image className="profile-avatar" src={person.avatar} alt={`${person.name}头像`} width={132} height={132} />
        <h1>{person.name}</h1>
        <RoleTags roles={person.roles} />
        <dl className="definition-list">
          <div>
            <dt>城市 / 地区</dt>
            <dd>{person.city}</dd>
          </div>
          <div>
            <dt>主项 / 方向</dt>
            <dd>{person.mainEvent || "待补充"}</dd>
          </div>
          <div>
            <dt>WCA ID</dt>
            <dd>{person.wcaId || "待补充"}</dd>
          </div>
          <div>
            <dt>排名说明</dt>
            <dd>{person.rankingNote || "待整理"}</dd>
          </div>
        </dl>
        <div className="section-actions profile-external-links">
          {person.wcaUrl ? (
            <Link className="button" href={person.wcaUrl} target="_blank" rel="noopener noreferrer">
              WCA 主页
              <ExternalLink size={16} />
            </Link>
          ) : null}
          {person.wcaId ? (
            <Link className="button button-secondary" href={`https://cubing.com/results/person/${person.wcaId}`} target="_blank" rel="noopener noreferrer">
              Cubing 主页
              <ExternalLink size={16} />
            </Link>
          ) : null}
        </div>
      </aside>

      <div className="detail-main">
        <div className="info-block">
          <h2>个人简介</h2>
          <p>{person.bio}</p>
          <div className="tag-row" style={{ marginTop: 14 }}>
            {person.specialties?.map((item) => (
              <span className="tag" key={item}>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="info-block">
          <h2>参与赛事与活动</h2>
          <div className="timeline">
            {competitions.map((item) =>
              item.competition ? (
                <Link className="timeline-item" href={`/competitions/${item.competition.slug}`} key={item.competitionId}>
                  <strong>{getCompetitionDisplayName(item.competition)}</strong>
                  <span>
                    {item.type} · {item.competition.date} · {item.note || "备注待补充"}
                  </span>
                </Link>
              ) : null
            )}
          </div>
        </div>

        <div className="info-block">
          <h2>重要荣誉或勋章</h2>
          <div className="grid two profile-achievements">
            {achievements.length > 0 ? (
              achievements.map((achievement) => (
                <AchievementBadge
                  description={achievement.description}
                  key={achievement.id}
                  title={achievement.title}
                  type={achievement.type}
                />
              ))
            ) : (
              <p>暂无公开荣誉记录，后续可由后台继续补充。</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
