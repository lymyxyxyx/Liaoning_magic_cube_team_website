import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import {
  nationalAllAroundResults,
  nationalRelayResults,
  nationalResults,
  type NationalAllAroundRow,
  type NationalRelayRow,
  type NationalResultRow
} from "@/lib/national-results";

type ResultGroup = {
  key: string;
  id: string;
  event: string;
  group: string;
  rows: NationalResultRow[];
};

type AllAroundGroup = {
  key: string;
  id: string;
  event: string;
  group: string;
  rows: NationalAllAroundRow[];
};

type RelayGroup = {
  key: string;
  id: string;
  group: string;
  rows: NationalRelayRow[];
};

type EventIndexGroup<T extends { event: string }> = {
  event: string;
  groups: T[];
};

const resultIndexSections = [
  {
    title: "五组别项目",
    description: "三阶、二阶、枫叶",
    events: ["三阶", "二阶", "枫叶"]
  },
  {
    title: "三项年龄组项目",
    description: "金字塔、斜转、镜面",
    events: ["金字塔", "斜转", "镜面"]
  },
  {
    title: "二重奏",
    description: "U6组",
    events: ["二重奏"]
  },
  {
    title: "公开组项目",
    description: "redi、四阶、五阶、六阶、七阶",
    events: ["redi", "四阶", "五阶", "六阶", "七阶"]
  }
];

function makeId(prefix: string, key: string) {
  return `${prefix}-${key.replace(/[^\p{Script=Han}A-Za-z0-9]+/gu, "-").replace(/^-|-$/g, "")}`;
}

function groupResults(rows: NationalResultRow[]) {
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
      id: makeId("single", key),
      event: row.event,
      group: row.group,
      rows: [row]
    });
  });

  return Array.from(groups.values());
}

function groupAllAroundResults(rows: NationalAllAroundRow[]) {
  const groups = new Map<string, AllAroundGroup>();

  rows.forEach((row) => {
    const key = `${row.event}-${row.group}`;
    const current = groups.get(key);
    if (current) {
      current.rows.push(row);
      return;
    }

    groups.set(key, {
      key,
      id: makeId("all-around", key),
      event: row.event,
      group: row.group,
      rows: [row]
    });
  });

  return Array.from(groups.values());
}

function groupRelayResults(rows: NationalRelayRow[]) {
  const groups = new Map<string, RelayGroup>();

  rows.forEach((row) => {
    const key = row.group;
    const current = groups.get(key);
    if (current) {
      current.rows.push(row);
      return;
    }

    groups.set(key, {
      key,
      id: makeId("relay", key),
      group: row.group,
      rows: [row]
    });
  });

  return Array.from(groups.values());
}

function groupIndexByEvent<T extends { event: string }>(groups: T[]) {
  const eventGroups = new Map<string, EventIndexGroup<T>>();

  groups.forEach((group) => {
    const current = eventGroups.get(group.event);
    if (current) {
      current.groups.push(group);
      return;
    }

    eventGroups.set(group.event, {
      event: group.event,
      groups: [group]
    });
  });

  return Array.from(eventGroups.values());
}

function pickEventIndexGroups<T extends { event: string }>(groups: EventIndexGroup<T>[], events: string[]) {
  return events.map((event) => groups.find((group) => group.event === event)).filter(Boolean) as EventIndexGroup<T>[];
}

function isShenyangTeam(team: string) {
  return team.includes("沈阳市魔方代表队");
}

export default function NationalResultsPage() {
  const resultGroups = groupResults(nationalResults);
  const allAroundGroups = groupAllAroundResults(nationalAllAroundResults);
  const relayGroups = groupRelayResults(nationalRelayResults);
  const singleEventIndexGroups = groupIndexByEvent(resultGroups);
  const allAroundEventIndexGroups = groupIndexByEvent(allAroundGroups);
  const allRows = [...nationalResults, ...nationalAllAroundResults];
  const eventCount = new Set(allRows.map((row) => row.event)).size;
  const teamCount = new Set([
    ...allRows.map((row) => row.team).filter(Boolean),
    ...nationalRelayResults.map((row) => row.team)
  ]).size;
  const rowCount = nationalResults.length + nationalAllAroundResults.length + nationalRelayResults.length;

  return (
    <>
      <PageHero
        label="第一站 · 江苏盐城东台"
        title="比赛成绩"
        actions={
          <>
            <Link className="button" href="/national-events">
              <ArrowLeft size={16} />
              返回国赛专题
            </Link>
            <Link className="button primary" href="/national-events/qualifiers">
              <Trophy size={16} />
              晋级名单
            </Link>
          </>
        }
      >
        整理 2026年中国魔方运动巡回赛第一站已录入的各组别成绩，包含三次还原、最终成绩和名次。
      </PageHero>

      <section className="container section national-topic-section">
        <div className="national-qualifier-summary">
          <div className="stat">
            <strong>{eventCount}</strong>
            <span>已录入项目</span>
          </div>
          <div className="stat">
            <strong>{teamCount}</strong>
            <span>参赛队伍</span>
          </div>
          <div className="stat">
            <strong>{rowCount}</strong>
            <span>成绩记录</span>
          </div>
        </div>

        <section className="national-result-index" aria-label="成绩索引">
          <div>
            <span className="eyebrow">快速查询</span>
            <h2>按项目跳转</h2>
          </div>
          <div className="national-result-index-group">
            <strong>个人单项赛</strong>
            <div className="national-result-index-events">
              {resultIndexSections.map((section) => (
                <div className="national-result-index-section" key={section.title}>
                  <div>
                    <strong>{section.title}</strong>
                    <span>{section.description}</span>
                  </div>
                  {pickEventIndexGroups(singleEventIndexGroups, section.events).map((eventGroup) => (
                    <div className="national-result-index-event" key={eventGroup.event}>
                      <span>{eventGroup.event}</span>
                      <div>
                        {eventGroup.groups.map((group) => (
                          <a href={`#${group.id}`} key={group.key}>
                            {group.group}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="national-result-index-group">
            <strong>个人全能与团体</strong>
            <div className="national-result-index-events compact">
              <div className="national-result-index-section">
                <div>
                  <strong>个人全能</strong>
                  <span>男子、女子</span>
                </div>
                {allAroundEventIndexGroups.map((eventGroup) => (
                  <div className="national-result-index-event" key={eventGroup.event}>
                    <span>{eventGroup.event.replace("个人全能", "")}</span>
                    <div>
                      {eventGroup.groups.map((group) => (
                        <a href={`#${group.id}`} key={group.key}>
                          {group.group}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="national-result-index-section">
                <div>
                  <strong>团体接力赛</strong>
                  <span>男子、女子、混合</span>
                </div>
                <div className="national-result-index-event">
                  <span>团体</span>
                  <div>
                    {relayGroups.map((group) => (
                      <a href={`#${group.id}`} key={group.key}>
                        {group.group}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="national-qualifier-list">
          {resultGroups.map((group) => (
            <details className="national-qualifier-event" id={group.id} key={group.key} open>
              <summary>
                <strong>
                  {group.event} · {group.group}
                </strong>
                <span>{group.rows.length} 条成绩</span>
              </summary>
              <div className="national-qualifier-table-wrap">
                <table className="national-result-table">
                  <thead>
                    <tr>
                      <th>名次</th>
                      <th>姓名</th>
                      <th>性别</th>
                      <th>代表队</th>
                      <th>第一次</th>
                      <th>第二次</th>
                      <th>第三次</th>
                      <th>{group.event === "三盲" ? "最终成绩（三次最佳）" : "最终成绩（三次平均）"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row, rowIndex) => (
                      <tr
                        className={isShenyangTeam(row.team) ? "shenyang-team-row" : undefined}
                        key={`${group.key}-${row.rank || rowIndex}-${row.name}`}
                      >
                        <td>{row.rank || "-"}</td>
                        <td>{row.name}</td>
                        <td>{row.gender}</td>
                        <td>{row.team}</td>
                        <td>{row.first || "-"}</td>
                        <td>{row.second || "-"}</td>
                        <td>{row.third || "-"}</td>
                        <td>{row.final || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}

          {allAroundGroups.map((group) => (
            <details className="national-qualifier-event" id={group.id} key={group.key} open>
              <summary>
                <strong>
                  {group.event} · {group.group}
                </strong>
                <span>{group.rows.length} 条成绩</span>
              </summary>
              <div className="national-qualifier-table-wrap">
                <table className="national-all-around-table">
                  <thead>
                    <tr>
                      <th>名次</th>
                      <th>姓名</th>
                      <th>性别</th>
                      <th>代表队</th>
                      <th>最终成绩</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row, rowIndex) => (
                      <tr
                        className={isShenyangTeam(row.team) ? "shenyang-team-row" : undefined}
                        key={`${group.key}-${row.rank || rowIndex}-${row.name}`}
                      >
                        <td>{row.rank || "-"}</td>
                        <td>{row.name}</td>
                        <td>{row.gender}</td>
                        <td>{row.team}</td>
                        <td>{row.final}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}

          {relayGroups.map((group) => (
            <details className="national-qualifier-event" id={group.id} key={group.key} open>
              <summary>
                <strong>团体接力赛 · {group.group}</strong>
                <span>{group.rows.length} 条成绩</span>
              </summary>
              <div className="national-qualifier-table-wrap">
                <table className="national-relay-table">
                  <thead>
                    <tr>
                      <th>名次</th>
                      <th>代表队</th>
                      <th>组别</th>
                      <th>队长</th>
                      <th>队员</th>
                      <th>最终成绩</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr
                        className={isShenyangTeam(row.team) ? "shenyang-team-row" : undefined}
                        key={`${group.key}-${row.rank}-${row.team}-${row.captain}`}
                      >
                        <td>{row.rank}</td>
                        <td>{row.team}</td>
                        <td>{row.group}</td>
                        <td>{row.captain}</td>
                        <td>{row.members.join("、")}</td>
                        <td>{row.final}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
