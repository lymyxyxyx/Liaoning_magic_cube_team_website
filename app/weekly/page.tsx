import Link from "next/link";
import { BarChart3, CalendarDays, ListChecks, Medal, Trophy } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { bigStackIntro, getRankedBigStackRecords } from "@/lib/big-stack";
import { people } from "@/lib/data";
import { getWeeklyMeets } from "@/lib/weekly-db";

export const dynamic = "force-dynamic";

export default async function WeeklyPage() {
  const weeklyMeets = await getWeeklyMeets();
  const bigStackRanking = getRankedBigStackRecords();
  const peopleByName = new Map(people.map((person) => [person.name, person]));
  const topThree = bigStackRanking.slice(0, 3);
  const leader = bigStackRanking[0];
  const topTenAverage = Math.round(
    bigStackRanking.slice(0, 10).reduce((total, record) => total + record.count, 0) / 10
  );

  const latestMeet = weeklyMeets[0];
  const earliestWeekNumber = weeklyMeets.length > 0 ? Math.min(...weeklyMeets.map((m) => m.weekNumber)) : 1;
  const previousWeeks = Array.from({ length: earliestWeekNumber - 1 }, (_, i) => earliestWeekNumber - 1 - i);

  return (
    <>
      <PageHero
        actions={
          <Link className="button" href="/weekly/admin">
            周赛录入后台
          </Link>
        }
        label="队内周赛"
        title="辽宁魔方少儿战队周赛"
      >
        周赛用于记录队内选手的阶段成绩。选手不需要先注册账号，也可以先作为自然人档案平铺录入，后续登录后再关联个人主页。
      </PageHero>

      <section className="container section">
        {latestMeet ? (
          <Link className="weekly-feature" href={`/weekly/${latestMeet.slug}`}>
            <div>
              <span className="card-kicker">
                <Trophy size={15} />
                最新周赛
              </span>
              <h2>{latestMeet.title}</h2>
              <p>{latestMeet.summary}</p>
              <div className="weekly-feature-meta">
                <span>
                  <CalendarDays size={15} />
                  {latestMeet.dateLabel}
                </span>
                <span>
                  <ListChecks size={15} />
                  {latestMeet.results.length} 名选手
                </span>
              </div>
            </div>
            <strong>查看成绩</strong>
          </Link>
        ) : null}

        <div className="section-header weekly-list-header">
          <div>
            <h2>历史周赛</h2>
            <p>已录入的周赛可直接查看详情，尚未整理的周赛先占位，后续可把图片逐期转成结构化成绩。</p>
          </div>
        </div>
        <div className="recorded-week-list">
          {weeklyMeets.slice(1).map((meet) => (
            <Link className="recorded-week-card" href={`/weekly/${meet.slug}`} key={meet.id}>
              <span>{meet.title}</span>
              <small>{meet.publishedAt ? `发布时间：${meet.publishedAt}` : meet.dateLabel}</small>
            </Link>
          ))}
        </div>
        <div className="weekly-list">
          {previousWeeks.map((weekNumber) => (
            <div className="weekly-list-item pending" key={weekNumber}>
              <span>辽宁魔方少儿战队第{weekNumber}周周赛总结</span>
              <small>待录入</small>
            </div>
          ))}
        </div>

        <section className="big-stack-section">
          <div className="section-header">
            <div>
              <span className="eyebrow">单轮大堆</span>
              <h2>个人单轮大堆纪录</h2>
              <p>{bigStackIntro}</p>
            </div>
          </div>

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

        <section className="weekly-join">
          <div>
            <span className="eyebrow">参与周赛</span>
            <h2>参赛、积分与奖品</h2>
            <p>
              参加周赛即可领取积分，兑换奖品。周赛规则及奖品设置可扫描下方二维码，关注辽宁魔方俱乐部公众号，点击"周赛"了解详情。
            </p>
          </div>
          <div className="qr-placeholder" aria-label="辽宁魔方俱乐部公众号二维码待上传">
            <span>二维码</span>
            <small>待上传</small>
          </div>
        </section>
      </section>
    </>
  );
}
