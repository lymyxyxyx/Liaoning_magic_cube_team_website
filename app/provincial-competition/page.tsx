import { CalendarDays, MapPin, Medal, Trophy } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { provincialResults, type ProvincialResultRow } from "@/lib/provincial-results";

type ResultGroup = {
  key: string;
  id: string;
  event: string;
  group: string;
  rows: ProvincialResultRow[];
};

const eventOrder = ["三阶", "二阶", "金字塔", "枫叶", "镜面", "二盲", "三盲"];
const groupOrder = ["U6组", "U8组", "U10组", "U12组", "O12组"];

const eventIntro = {
  三阶: "197 条",
  二阶: "150 条",
  金字塔: "112 条",
  枫叶: "109 条",
  镜面: "69 条",
  二盲: "76 条",
  三盲: "13 条"
} as const;

function makeId(prefix: string, key: string) {
  return `${prefix}-${key.replace(/[^\p{Script=Han}A-Za-z0-9]+/gu, "-").replace(/^-|-$/g, "")}`;
}

function sortByKnownOrder(value: string, order: string[]) {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

function groupResults(rows: ProvincialResultRow[]) {
  const groups = new Map<string, ResultGroup>();

  rows.forEach((row) => {
    const key = `${row.event}-${row.group}`;
    const current = groups.get(key);
    if (current) {
      current.rows.push(row);
      return;
    }

    groups.set(key, {
      key,
      id: makeId("provincial", key),
      event: row.event,
      group: row.group,
      rows: [row]
    });
  });

  return Array.from(groups.values()).sort((a, b) => {
    const eventDiff = sortByKnownOrder(a.event, eventOrder) - sortByKnownOrder(b.event, eventOrder);
    if (eventDiff !== 0) return eventDiff;
    return sortByKnownOrder(a.group, groupOrder) - sortByKnownOrder(b.group, groupOrder);
  });
}

function formatCell(value: string) {
  return value || "-";
}

export default function ProvincialCompetitionPage() {
  const resultGroups = groupResults(provincialResults);
  const eventCount = new Set(provincialResults.map((row) => row.event)).size;
  const participantCount = new Set(provincialResults.map((row) => row.code)).size;
  const podiumCount = provincialResults.filter((row) => ["1", "2", "3"].includes(row.rank)).length;

  return (
    <>
      <PageHero
        label="省赛专题"
        title="2026年辽宁省魔方运动公开赛"
        actions={
          <a className="button primary" href="#provincial-results">
            <Trophy size={16} />
            查看成绩
          </a>
        }
      >
        辽宁省体育总会、沈阳市浑南区体育局主办的省级公开赛事。成绩已按项目与年龄组平铺整理，方便快速查询每轮成绩、最佳成绩和名次。
      </PageHero>

      <section className="container section provincial-section">
        <div className="provincial-info-grid">
          <div className="provincial-info-card">
            <CalendarDays size={18} />
            <div>
              <span>比赛时间</span>
              <strong>2026年5月17日</strong>
            </div>
          </div>
          <div className="provincial-info-card">
            <MapPin size={18} />
            <div>
              <span>比赛地点</span>
              <strong>沈阳市浑南区欧亚长青城</strong>
            </div>
          </div>
          <div className="provincial-info-card">
            <Medal size={18} />
            <div>
              <span>竞赛项目</span>
              <strong>二阶、三阶、金字塔、枫叶、镜面、二盲、三盲</strong>
            </div>
          </div>
        </div>

        <div className="national-qualifier-summary">
          <div className="stat">
            <strong>{eventCount}</strong>
            <span>已录入项目</span>
          </div>
          <div className="stat">
            <strong>{participantCount}</strong>
            <span>参赛选手</span>
          </div>
          <div className="stat">
            <strong>{provincialResults.length}</strong>
            <span>成绩记录</span>
          </div>
        </div>

        <section className="national-result-index provincial-result-index" aria-label="省赛成绩索引">
          <div>
            <span className="eyebrow">快速查询</span>
            <h2>按项目跳转</h2>
          </div>
          <div className="national-result-index-events">
            {eventOrder.map((event) => {
              const groups = resultGroups.filter((group) => group.event === event);
              if (groups.length === 0) return null;

              return (
                <div className="national-result-index-section" key={event}>
                  <div>
                    <strong>{event}</strong>
                    <span>{eventIntro[event as keyof typeof eventIntro]}</span>
                  </div>
                  <div className="national-result-index-event">
                    <span>组别</span>
                    <div>
                      {groups.map((group) => (
                        <a href={`#${group.id}`} key={group.key}>
                          {group.group}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="provincial-results" id="provincial-results" aria-label="省赛成绩">
          <div className="provincial-results-heading">
            <div>
              <span className="eyebrow">比赛成绩</span>
              <h2>详细成绩</h2>
            </div>
            <p>共 {podiumCount} 条前三名获奖记录；表格按原始成绩单排名顺序展示。</p>
          </div>

          <div className="provincial-result-list">
            {resultGroups.map((group) => (
              <article className="provincial-result-group" id={group.id} key={group.key}>
                <header>
                  <h3>
                    {group.event} · {group.group}
                  </h3>
                  <span>{group.rows.length} 条成绩</span>
                </header>
                <div className="national-qualifier-table-wrap">
                  <table className="national-result-table provincial-result-table">
                    <thead>
                      <tr>
                        <th>名次</th>
                        <th>编号</th>
                        <th>姓名</th>
                        <th>性别</th>
                        <th>年龄</th>
                        <th>第1轮</th>
                        <th>第2轮</th>
                        <th>第3轮</th>
                        <th>最佳成绩</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row, rowIndex) => (
                        <tr className={["1", "2", "3"].includes(row.rank) ? "podium-row" : undefined} key={`${group.key}-${row.code}-${row.event}-${rowIndex}`}>
                          <td>{formatCell(row.rank)}</td>
                          <td>{row.code}</td>
                          <td>{row.name}</td>
                          <td>{row.gender}</td>
                          <td>{row.age ?? "-"}</td>
                          <td>{formatCell(row.first)}</td>
                          <td>{formatCell(row.second)}</td>
                          <td>{formatCell(row.third)}</td>
                          <td>{formatCell(row.best)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}
