import Link from "next/link";
import { BarChart3, Medal, Trophy } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { bigStackIntro, getRankedBigStackRecords } from "@/lib/big-stack";
import { people } from "@/lib/data";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";
import { notFound } from "next/navigation";

export default function WeeklyBigStackPage() {
  if (!isWeeklyCompetitionEnabled()) notFound();
  const bigStackRanking = getRankedBigStackRecords();
  const peopleByName = new Map(people.map((person) => [person.name, person]));
  const topThree = bigStackRanking.slice(0, 3);
  const leader = bigStackRanking[0];
  const topTenAverage = Math.round(
    bigStackRanking.slice(0, 10).reduce((total, record) => total + record.count, 0) / 10
  );

  return (
    <>
      <PageHero
        actions={
          <Link className="button" href="/weekly">
            返回周赛
          </Link>
        }
        label="单轮大堆"
        title="个人单轮大堆纪录"
      >
        {bigStackIntro}
      </PageHero>

      <section className="container section big-stack-section big-stack-section--standalone">
        <div className="big-stack-hero">
          <div className="big-stack-leader">
            <span className="card-kicker">
              <Trophy size={15} />
              当前最高纪录
            </span>
            <strong>{leader.count}</strong>
            <p>{leader.name}</p>
          </div>
          <div className="big-stack-stats">
            <div>
              <span>收录选手</span>
              <strong>{bigStackRanking.length}</strong>
            </div>
            <div>
              <span>前十均值</span>
              <strong>{topTenAverage}</strong>
            </div>
            <div>
              <span>入榜线</span>
              <strong>{bigStackRanking[bigStackRanking.length - 1].count}</strong>
            </div>
          </div>
        </div>

        <div className="big-stack-podium">
          {topThree.map((record, index) => (
            <div className={`podium-card podium-${index + 1}`} key={record.name}>
              <Medal size={22} />
              <small>第 {index + 1} 名</small>
              {peopleByName.get(record.name) ? (
                <Link href={`/people/${peopleByName.get(record.name)?.slug}`}>
                  <strong>{record.name}</strong>
                </Link>
              ) : (
                <strong>{record.name}</strong>
              )}
              <em>{peopleByName.get(record.name)?.gender || "待建档"}</em>
              <span>{record.count} 个</span>
            </div>
          ))}
        </div>

        <div className="big-stack-ranking" aria-label="个人单轮大堆纪录排行榜">
          {bigStackRanking.map((record, index) => {
            const width = `${Math.max(12, Math.round((record.count / leader.count) * 100))}%`;
            const person = peopleByName.get(record.name);

            return (
              <div className="big-stack-row" key={`${record.name}-${record.count}`}>
                <span className="big-stack-rank">{index + 1}</span>
                <span className="big-stack-name">
                  {person ? <Link href={`/people/${person.slug}`}>{record.name}</Link> : record.name}
                </span>
                <span className={`big-stack-gender ${person ? "" : "pending"}`}>{person?.gender || "待建档"}</span>
                <div className="big-stack-bar" aria-hidden="true">
                  <span style={{ width }} />
                </div>
                <strong>{record.count}</strong>
              </div>
            );
          })}
        </div>

        <div className="big-stack-footnote">
          <BarChart3 size={16} />
          当前先将截图榜单转为结构化数据展示，后续每次刷新纪录可直接追加或更新选手数据。
        </div>
      </section>
    </>
  );
}
