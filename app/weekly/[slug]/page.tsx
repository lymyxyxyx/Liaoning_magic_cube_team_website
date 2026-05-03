import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { getSingleBest, type WeeklyEvent } from "@/lib/weekly";
import { getWeeklyMeetBySlug } from "@/lib/weekly-db";

export const dynamic = "force-dynamic";

function formatAttempt(value: number | "DNF" | null) {
  if (value === null) {
    return "-";
  }

  return typeof value === "number" ? value.toFixed(2) : value;
}

export default async function WeeklyDetailPage({ params }: { params: { slug: string } }) {
  const meet = await getWeeklyMeetBySlug(params.slug);

  if (!meet) {
    notFound();
  }

  const eventSections: WeeklyEvent[] = [
    {
      id: "three",
      title: `三阶比赛第${meet.yearWeek}周`,
      eventName: "三阶",
      results: meet.results
    },
    ...meet.events
  ];

  return (
    <>
      <PageHero
        actions={
          <Link className="button" href="/weekly">
            <ArrowLeft size={16} />
            返回周赛
          </Link>
        }
        label={`${meet.event} · 第${meet.weekNumber}周`}
        title={meet.title}
      >
        选手姓名可进入个人主页，原始截图中的成绩先转成可视化数据；个人 PB 标红代表本周刷新成绩。
      </PageHero>

      <section className="container section">
        <div className="weekly-intro">
          {meet.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <strong>{meet.pbNote}</strong>
        </div>

        <div className="weekly-summary-grid">
          <div className="stat">
            <strong>{meet.results.length}</strong>
            <span>参赛选手</span>
          </div>
          <div className="stat">
            <strong>{formatAttempt(meet.results[0] ? getSingleBest(meet.results[0].attempts) : null)}</strong>
            <span>冠军本周最快</span>
          </div>
          <div className="stat">
            <strong>{meet.results[0] ? meet.results[0].average.toFixed(2) : "-"}</strong>
            <span>冠军平均</span>
          </div>
          <div className="stat">
            <strong>{meet.dateLabel}</strong>
            <span>周赛周期</span>
          </div>
        </div>

        <div className="weekly-event-stack">
          {eventSections.map((event) => {
            const hasAgeGroup = event.results.some((result) => result.ageGroup);
            const hasAttempts = !event.isAllAround;

            const table = (
              <section className="weekly-event-section">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">{event.groupName || event.eventName}</span>
                    <h2>{event.title}</h2>
                  </div>
                </div>
                <div className="result-table-wrap">
                  <table className={`result-table ${event.isAllAround ? "all-around-table" : ""}`}>
                    <thead>
                      <tr>
                        <th>排名</th>
                        <th>姓名</th>
                        <th>性别</th>
                        {hasAgeGroup ? <th>年龄组</th> : null}
                        {hasAttempts ? <th>段位</th> : null}
                        {hasAttempts ? <th>等级</th> : null}
                        <th>{event.isAllAround ? "成绩" : "平均"}</th>
                        {hasAttempts ? <th>本周最快</th> : null}
                        <th>个人 PB</th>
                        {hasAttempts ? (
                          <>
                            <th>T1</th>
                            <th>T2</th>
                            <th>T3</th>
                            <th>T4</th>
                            <th>T5</th>
                          </>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {event.results.map((result) => {
                        const singleBest = getSingleBest(result.attempts);

                        return (
                          <tr key={`${event.id}-${result.rank}-${result.playerSlug}`}>
                            <td>{result.rank}</td>
                            <td>
                              <Link className="table-person-link" href={`/people/${result.playerSlug}`}>
                                {result.playerName}
                              </Link>
                            </td>
                            <td>{result.gender}</td>
                            {hasAgeGroup ? <td>{result.ageGroup || "-"}</td> : null}
                            {hasAttempts ? (
                              <td>
                                <span className={`level-pill level-${result.level}`}>{result.level}</span>
                              </td>
                            ) : null}
                            {hasAttempts ? <td className="grade-cell">{result.grade}</td> : null}
                            <td className="score-strong">{formatAttempt(result.average)}</td>
                            {hasAttempts ? <td>{formatAttempt(singleBest)}</td> : null}
                            <td className={`pb-cell ${result.pbRefreshed ? "pb-refreshed" : ""}`}>
                              {formatAttempt(result.personalBest)}
                            </td>
                            {hasAttempts
                              ? result.attempts.map((attempt, index) => (
                                  <td className={attempt === singleBest ? "fastest-cell" : undefined} key={index}>
                                    {formatAttempt(attempt)}
                                  </td>
                                ))
                              : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );

            if (event.id !== "three") {
              return <div key={event.id}>{table}</div>;
            }

            return (
              <div key={event.id}>
                {table}
                <div className="weekly-age-note">
                  <p>{meet.threeAgeIntro}</p>
                </div>
                <div className="weekly-age-stack">
                  {meet.threeAgeGroups.map((ageEvent) => {
                    const ageBest = !ageEvent.isAllAround;
                    return (
                      <section className="weekly-event-section" key={ageEvent.id}>
                        <div className="section-header">
                          <div>
                            <span className="eyebrow">{ageEvent.groupName}</span>
                            <h2>{ageEvent.title}</h2>
                          </div>
                        </div>
                        <div className="result-table-wrap">
                          <table className="result-table">
                            <thead>
                              <tr>
                                <th>排名</th>
                                <th>姓名</th>
                                <th>性别</th>
                                <th>段位</th>
                                <th>等级</th>
                                <th>平均</th>
                                <th>本周最快</th>
                                <th>个人 PB</th>
                                <th>T1</th>
                                <th>T2</th>
                                <th>T3</th>
                                <th>T4</th>
                                <th>T5</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ageEvent.results.map((result) => {
                                const singleBest = getSingleBest(result.attempts);

                                return (
                                  <tr key={`${ageEvent.id}-${result.rank}-${result.playerSlug}`}>
                                    <td>{result.rank}</td>
                                    <td>
                                      <Link className="table-person-link" href={`/people/${result.playerSlug}`}>
                                        {result.playerName}
                                      </Link>
                                    </td>
                                    <td>{result.gender}</td>
                                    <td>
                                      <span className={`level-pill level-${result.level}`}>{result.level}</span>
                                    </td>
                                    <td className="grade-cell">{result.grade}</td>
                                    <td className="score-strong">{formatAttempt(result.average)}</td>
                                    {ageBest ? <td>{formatAttempt(singleBest)}</td> : null}
                                    <td className={`pb-cell ${result.pbRefreshed ? "pb-refreshed" : ""}`}>
                                      {formatAttempt(result.personalBest)}
                                    </td>
                                    {result.attempts.map((attempt, index) => (
                                      <td className={attempt === singleBest ? "fastest-cell" : undefined} key={index}>
                                        {formatAttempt(attempt)}
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
