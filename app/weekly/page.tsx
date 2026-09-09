import { PageHero } from "@/components/page-hero";
import Link from "next/link";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { isGuestWeeklyHistorySlug } from "@/lib/weekly-guest-history";

export const dynamic = "force-dynamic";

const events = [
  { code: "333", name: "三阶", format: "avg5" },
  { code: "222", name: "二阶", format: "avg5" },
  { code: "pyram", name: "金字塔", format: "avg5" },
  { code: "maple", name: "枫叶", format: "avg5" },
  { code: "mirror", name: "镜面", format: "avg5" },
  { code: "individual", name: "全能", format: "best1" }
] as const;

function getShanghaiWeekLabel() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  const today = new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const monday = new Date(today.getTime() - mondayOffset * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  const format = (date: Date) => `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${String(date.getUTCDate()).padStart(2, "0")}`;
  return `${format(monday)}-${format(sunday)}`;
}

export default async function WeeklyPage() {
  const weekLabel = getShanghaiWeekLabel();
  const historyMeets = (await listWeeklyMeetOptions())
    .filter((meet) => isGuestWeeklyHistorySlug(meet.slug))
    .sort((a, b) => (b.startsAt || "").localeCompare(a.startsAt || ""));

  return (
    <>
      <PageHero
        actions={
          <details className="weekly-history-menu">
            <summary>历史周赛</summary>
            <div>
              {historyMeets.map((meet) => (
                <Link href={`/weekly/${meet.slug}`} key={meet.id}>
                  {meet.slug.replace(/^(.+)-week-(\d+)$/, "$1 W$2")}
                </Link>
              ))}
            </div>
          </details>
        }
        label="辽宁线上周赛"
        title="本周周赛成绩"
      >
        本周成绩将在管理员录入后显示；当前游客可直接查看，不需要邀请码。
      </PageHero>

      <section className="container section">
        <div className="weekly-summary-grid">
          <div className="stat">
            <strong>0</strong>
            <span>参赛选手</span>
          </div>
          <div className="stat">
            <strong>-</strong>
            <span>冠军本周最快</span>
          </div>
          <div className="stat">
            <strong>-</strong>
            <span>冠军平均</span>
          </div>
          <div className="stat">
            <strong>{weekLabel}</strong>
            <span>周赛周期</span>
          </div>
        </div>

        <nav className="weekly-event-tabs" aria-label="周赛项目导航">
          {events.map((event) => <a href={`#weekly-event-${event.code}`} key={event.code}>{event.code} {event.name}</a>)}
        </nav>

        <div className="weekly-event-stack">
          {events.map((event) => {
            const isAllAround = event.format === "best1";
            return (
              <section className="weekly-event-section" id={`weekly-event-${event.code}`} key={event.code}>
                <div className="section-header">
                  <div>
                    <span className="eyebrow">{event.code}</span>
                    <h2>{event.name}</h2>
                  </div>
                </div>
                <div className="result-table-wrap">
                  <table className={`result-table ${isAllAround ? "all-around-table" : ""}`}>
                    <thead>
                      <tr>
                        <th>排名</th>
                        <th>姓名</th>
                        <th>性别</th>
                        {!isAllAround ? <><th>段位</th><th>等级</th></> : null}
                        <th>{isAllAround ? "成绩" : "平均"}</th>
                        {!isAllAround ? <th>本周最快</th> : null}
                        <th>个人 PB</th>
                        {!isAllAround ? <><th>T1</th><th>T2</th><th>T3</th><th>T4</th><th>T5</th></> : null}
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td className="empty-state" colSpan={isAllAround ? 5 : 13}>本周暂无已录入成绩。</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </>
  );
}
