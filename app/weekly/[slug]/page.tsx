import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { getSingleBest, type WeeklyEvent } from "@/lib/weekly";
import { getWeeklyMeetBySlug } from "@/lib/weekly-db";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";
import { hasWeeklyAdminCookie } from "@/lib/weekly-admin-auth";
import { sortWeeklyResultsByAverage } from "@/lib/weekly-result-display";
import { isGuestWeeklyHistorySlug } from "@/lib/weekly-guest-history";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { WeeklyHistoryMenu } from "@/components/weekly-history-menu";

export const dynamic = "force-dynamic";

function formatAttempt(value: number | "DNF" | "DNS" | null) {
  if (value === null) {
    return "-";
  }

  if (typeof value === "number") {
    return value < 0 ? "DNF" : value.toFixed(2);
  }

  return value;
}

const eventTabLabels: Record<string, string> = {
  "333": "333 三阶",
  "222": "222 二阶",
  pyram: "pyram 金字塔",
  maple: "maple 枫叶",
  mirror: "mirror 镜面",
  individual: "individual 全能"
};

function eventTabLabel(event: WeeklyEvent) {
  return eventTabLabels[event.eventCode || ""] || event.eventName;
}

function eventAnchorId(event: WeeklyEvent) {
  return `weekly-event-${event.eventCode || event.id}`;
}

export default async function WeeklyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isWeeklyCompetitionEnabled()) notFound();
  const { slug } = await params;
  const includePrivate = isGuestWeeklyHistorySlug(slug) || await hasWeeklyAdminCookie(await cookies());
  const meet = await getWeeklyMeetBySlug(slug, { includePrivate });

  if (!meet) {
    notFound();
  }
  const historyMeets = (await listWeeklyMeetOptions())
    .filter((candidate) => isGuestWeeklyHistorySlug(candidate.slug))
    .sort((a, b) => new Date(b.startsAt || 0).getTime() - new Date(a.startsAt || 0).getTime());

  const mainResults = sortWeeklyResultsByAverage(meet.results);
  const eventSections: WeeklyEvent[] = [
    ...(meet.results.length > 0 ? [{
      id: "333",
      eventCode: "333",
      title: `三阶比赛第${meet.yearWeek}周`,
      eventName: "三阶",
      results: mainResults
    }] : []),
    ...meet.events.map((event) => ({ ...event, results: sortWeeklyResultsByAverage(event.results) }))
  ].map((event) => ({
    ...event,
    results: sortWeeklyResultsByAverage(event.results)
  }));

  return (
    <>
      <PageHero
        className="weekly-detail-page-hero"
        actions={
          <div className="weekly-page-actions">
            <WeeklyHistoryMenu meets={historyMeets} />
            <Link className="button" href="/weekly">
              <ArrowLeft size={16} />
              返回本周周赛
            </Link>
          </div>
        }
        label={`${meet.event} · 第${meet.weekNumber}周`}
        title={meet.title}
      >
        选手姓名可进入个人主页，原始截图中的成绩先转成可视化数据；个人 PB 标红代表本周刷新成绩。
      </PageHero>

      <section className="container section weekly-detail-content">
        <div className="weekly-intro">
          {meet.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <strong>{meet.pbNote}</strong>
        </div>

        <div className="weekly-summary-grid">
          <div className="stat">
            <strong>{mainResults.length}</strong>
            <span>参赛选手</span>
          </div>
          <div className="stat">
            <strong>{formatAttempt(mainResults[0] ? getSingleBest(mainResults[0].attempts) : null)}</strong>
            <span>冠军本周最快</span>
          </div>
          <div className="stat">
            <strong>{mainResults[0] ? mainResults[0].average.toFixed(2) : "-"}</strong>
            <span>冠军平均</span>
          </div>
          <div className="stat">
            <strong>{meet.dateLabel}</strong>
            <span>周赛周期</span>
          </div>
        </div>

        <nav className="weekly-event-tabs" aria-label="周赛项目导航">
          {eventSections.map((event) => (
            <a href={`#${eventAnchorId(event)}`} key={event.id}>{eventTabLabel(event)}</a>
          ))}
        </nav>

        <div className="weekly-event-stack">
          {eventSections.map((event) => {
            const hasAgeGroup = event.results.some((result) => result.ageGroup);
            const hasAttempts = !event.isAllAround;

            const table = (
              <section className="weekly-event-section" id={eventAnchorId(event)}>
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
                            <td data-label="排名">{result.rank}</td>
                            <td data-label="姓名">
                              {result.playerSlug ? (
                                <Link className="table-person-link" href={`/people/${result.playerSlug}`}>
                                  {result.playerName}
                                </Link>
                              ) : (
                                result.playerName
                              )}
                            </td>
                            <td data-label="性别">{result.gender}</td>
                            {hasAgeGroup ? <td data-label="年龄组">{result.ageGroup || "-"}</td> : null}
                            {hasAttempts ? (
                              <td data-label="段位">
                                <span className={`level-pill level-${result.level}`}>{result.level}</span>
                              </td>
                            ) : null}
                            {hasAttempts ? <td data-label="等级" className="grade-cell">{result.grade}</td> : null}
                            <td data-label="平均" className="score-strong">{formatAttempt(result.average)}</td>
                            {hasAttempts ? <td data-label="本周最快">{formatAttempt(singleBest)}</td> : null}
                            <td data-label="个人PB" className={`pb-cell ${result.pbRefreshed ? "pb-refreshed" : ""}`}>
                              {formatAttempt(result.personalBest)}
                            </td>
                            {hasAttempts
                              ? result.attempts.map((attempt, index) => (
                                  <td data-label={`T${index + 1}`} className={attempt === singleBest ? "fastest-cell" : undefined} key={index}>
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
                    const sortedAgeResults = sortWeeklyResultsByAverage(ageEvent.results);
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
                              {sortedAgeResults.map((result) => {
                                const singleBest = getSingleBest(result.attempts);

                                return (
                                  <tr key={`${ageEvent.id}-${result.rank}-${result.playerSlug}`}>
                                    <td data-label="排名">{result.rank}</td>
                                    <td data-label="姓名">
                                      {result.playerSlug ? (
                                        <Link className="table-person-link" href={`/people/${result.playerSlug}`}>
                                          {result.playerName}
                                        </Link>
                                      ) : (
                                        result.playerName
                                      )}
                                    </td>
                                    <td data-label="性别">{result.gender}</td>
                                    <td data-label="段位">
                                      <span className={`level-pill level-${result.level}`}>{result.level}</span>
                                    </td>
                                    <td data-label="等级" className="grade-cell">{result.grade}</td>
                                    <td data-label="平均" className="score-strong">{formatAttempt(result.average)}</td>
                                    {ageBest ? <td data-label="本周最快">{formatAttempt(singleBest)}</td> : null}
                                    <td data-label="个人PB" className={`pb-cell ${result.pbRefreshed ? "pb-refreshed" : ""}`}>
                                      {formatAttempt(result.personalBest)}
                                    </td>
                                    {result.attempts.map((attempt, index) => (
                                      <td data-label={`T${index + 1}`} className={attempt === singleBest ? "fastest-cell" : undefined} key={index}>
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
