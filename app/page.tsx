import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, CalendarDays, UsersRound } from "lucide-react";
import { AchievementBadge, CompetitionCard, PersonCard } from "@/components/cards";
import { achievements, competitions, people } from "@/lib/data";

export default function HomePage() {
  const featuredPeople = people.filter((person) => person.visible).slice(0, 3);
  const featuredCompetitions = competitions.filter((competition) => competition.featured);
  const featuredAchievements = achievements.filter((achievement) => achievement.featured);

  return (
    <>
      <section className="split-hero">
        <div className="hero-copy">
          <span className="eyebrow">公开展示官网与基础档案库</span>
          <h1>辽宁魔方战队</h1>
          <p>
            先把战队人员、赛事活动、荣誉经历和资料整理状态沉淀下来，让成员、家长、合作单位和魔方爱好者都能清楚了解辽宁魔方的发展脉络。
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/athletes">
              <UsersRound size={18} />
              查看人员档案
            </Link>
            <Link className="button" href="/competitions">
              <CalendarDays size={18} />
              查看赛事活动
            </Link>
          </div>
        </div>
        <div className="hero-panel">
          <Image src="/visuals/home-cube.svg" alt="辽宁魔方战队视觉图" width={720} height={540} priority />
        </div>
      </section>

      <section className="stat-band" aria-label="第一阶段档案概览">
        <div className="stat">
          <strong>{people.length}</strong>
          <span>人员档案样例</span>
        </div>
        <div className="stat">
          <strong>{competitions.length}</strong>
          <span>赛事与活动</span>
        </div>
        <div className="stat">
          <strong>{achievements.length}</strong>
          <span>荣誉记录</span>
        </div>
        <div className="stat">
          <strong>3</strong>
          <span>资料完整度等级</span>
        </div>
      </section>

      <section className="container section">
        <div className="section-header">
          <div>
            <h2>核心人员</h2>
            <p>人员以统一档案维护，一个人可以同时拥有运动员、教练员、裁判员等多个身份标签。</p>
          </div>
          <Link className="button" href="/athletes">
            全部人员
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid">
          {featuredPeople.map((person) => (
            <PersonCard person={person} key={person.id} />
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="section-header">
          <div>
            <h2>赛事活动</h2>
            <p>正式比赛、集训、推广和外出交流都可以进入档案，并标注资料状态，方便后续持续补齐。</p>
          </div>
          <Link className="button" href="/competitions">
            全部赛事
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid two">
          {featuredCompetitions.map((competition) => (
            <CompetitionCard competition={competition} key={competition.id} />
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="section-header">
          <div>
            <h2>荣誉与勋章</h2>
            <p>第一阶段先人工维护重点荣誉，后续可以逐步接入成绩数据库、排名统计和 WCA 数据同步。</p>
          </div>
          <Link className="button" href="/achievements">
            荣誉档案
            <Award size={16} />
          </Link>
        </div>
        <div className="grid">
          {featuredAchievements.map((achievement) => (
            <AchievementBadge
              description={achievement.description}
              key={achievement.id}
              title={achievement.title}
              type={achievement.type}
            />
          ))}
        </div>
      </section>
    </>
  );
}
