import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { nationalQualifiers, type NationalQualifier } from "@/lib/national-events";

type QualifierGroup = {
  key: string;
  event: string;
  group: string;
  rows: NationalQualifier[];
};

function groupQualifiers(rows: NationalQualifier[]) {
  const groups = new Map<string, QualifierGroup>();

  rows.forEach((row) => {
    const key = `${row.event}-${row.group}`;
    const current = groups.get(key);
    if (current) {
      current.rows.push(row);
      return;
    }

    groups.set(key, {
      key,
      event: row.event,
      group: row.group,
      rows: [row]
    });
  });

  return Array.from(groups.values());
}

export default function NationalQualifiersPage() {
  const qualifierGroups = groupQualifiers(nationalQualifiers);
  const eventCount = new Set(nationalQualifiers.map((row) => row.event)).size;

  return (
    <>
      <PageHero
        label="第一站 · 江苏盐城东台"
        title="总决赛晋级名单"
        actions={
          <>
            <Link className="button" href="/national-events">
              <ArrowLeft size={16} />
              返回国赛专题
            </Link>
            <Link className="button primary" href="/national-events/results">
              <ClipboardList size={16} />
              全部成绩
            </Link>
          </>
        }
      >
        汇总 2026年中国魔方运动巡回赛第一站各项目、各组别获得总决赛资格的选手与队伍。
      </PageHero>

      <section className="container section national-topic-section">
        <div className="national-qualifier-summary">
          <div className="stat">
            <strong>{eventCount}</strong>
            <span>晋级项目</span>
          </div>
          <div className="stat">
            <strong>{qualifierGroups.length}</strong>
            <span>项目组别</span>
          </div>
          <div className="stat">
            <strong>{nationalQualifiers.length}</strong>
            <span>晋级记录</span>
          </div>
        </div>

        <div className="national-qualifier-list">
          {qualifierGroups.map((group, index) => (
            <details className="national-qualifier-event" key={group.key} open={index < 3}>
              <summary>
                <strong>
                  {group.event} · {group.group}
                </strong>
                <span>{group.rows.length} 条记录</span>
              </summary>
              <div className="national-qualifier-table-wrap">
                <table className="national-qualifier-table">
                  <thead>
                    <tr>
                      <th>名次</th>
                      <th>姓名</th>
                      <th>性别/队伍</th>
                      <th>成绩</th>
                      <th>项目</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={`${group.key}-${row.rank}-${row.name}`}>
                        <td>{row.rank}</td>
                        <td>{row.name}</td>
                        <td>{row.genderOrTeam}</td>
                        <td>{row.result}</td>
                        <td>{row.event}</td>
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
