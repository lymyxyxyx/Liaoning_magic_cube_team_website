import Link from "next/link";
import { Database, ExternalLink, Trophy } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { getLiaoningRecords, type LocalRecordEvent, type LocalRecordGender, type LocalRecordResult } from "@/lib/local-records";

export const dynamic = "force-dynamic";

const genderOptions: { value: LocalRecordGender; label: string; title: string }[] = [
  { value: "all", label: "不限", title: "当前辽宁纪录" },
  { value: "m", label: "男子", title: "当前辽宁男子纪录" },
  { value: "f", label: "女子", title: "当前辽宁女子纪录" }
];

function recordLabel(record: LocalRecordResult | undefined) {
  if (!record) return "暂无";
  return record.mode === "single" ? "单次纪录" : "平均纪录";
}

function RecordCell({ record }: { record?: LocalRecordResult }) {
  if (!record) {
    return (
      <div className="liaoning-record-empty">
        <span>暂无成绩</span>
      </div>
    );
  }

  return (
    <div className="liaoning-record-cell">
      <div>
        <span className="liaoning-record-badge">LR</span>
        <strong>{record.value}</strong>
      </div>
      <Link className="liaoning-record-person" href={`https://www.worldcubeassociation.org/persons/${record.wcaId}`}>
        {record.personName}
        <ExternalLink size={13} />
      </Link>
      <span className="liaoning-record-meta">
        {record.city} · 中国第 {record.countryRank} · 世界第 {record.worldRank}
      </span>
      {record.competitionId ? (
        <Link className="liaoning-record-competition" href={`https://www.worldcubeassociation.org/competitions/${record.competitionId}`}>
          {record.competitionNameZh}
          <ExternalLink size={13} />
        </Link>
      ) : (
        <span className="liaoning-record-competition">比赛信息待同步</span>
      )}
      {record.date ? <span className="liaoning-record-date">{record.date}</span> : null}
      {record.attempts.length > 0 ? <span className="liaoning-record-attempts">{record.attempts.join("  ")}</span> : null}
    </div>
  );
}

function pickGender(value: string | string[] | undefined): LocalRecordGender {
  const next = Array.isArray(value) ? value[0] : value;
  return next === "m" || next === "f" ? next : "all";
}

function genderHref(gender: LocalRecordGender) {
  return gender === "all" ? "/liaoning-records" : `/liaoning-records?gender=${gender}`;
}

export default async function LiaoningRecordsPage({
  searchParams
}: {
  searchParams?: { gender?: string | string[] };
}) {
  const selectedGender = pickGender(searchParams?.gender);
  const selectedGenderOption = genderOptions.find((option) => option.value === selectedGender) || genderOptions[0];
  let records: LocalRecordEvent[] = [];
  let dataError = "";
  try {
    records = await getLiaoningRecords(selectedGender);
  } catch {
    dataError = "无法读取辽宁纪录数据，请确认 WCA 数据库已同步。";
  }
  const singleCount = records.filter((record) => record.single).length;
  const averageCount = records.filter((record) => record.average).length;

  return (
    <>
      <PageHero
        className="ranking-page-hero"
        label="本地省市归属"
        title="辽宁纪录"
        actions={
          <Link className="button primary" href="/liaoning-rankings">
            <Trophy size={16} />
            辽宁排名
          </Link>
        }
      >
        按本站辽宁本地名单关联 WCA 官方成绩，展示各 WCA 项目的辽宁单次、平均、男子与女子纪录。
      </PageHero>

      <section className="container section local-rankings-section liaoning-records-section">
        <nav className="liaoning-record-gender-tabs" aria-label="辽宁纪录分类">
          {genderOptions.map((option) => (
            <Link
              aria-current={selectedGender === option.value ? "page" : undefined}
              className={selectedGender === option.value ? "active" : ""}
              href={genderHref(option.value)}
              key={option.value}
            >
              {option.label}
            </Link>
          ))}
        </nav>

        <div className="national-qualifier-summary">
          <div className="stat">
            <strong>{records.length}</strong>
            <span>已覆盖项目</span>
          </div>
          <div className="stat">
            <strong>{singleCount}</strong>
            <span>单次纪录</span>
          </div>
          <div className="stat">
            <strong>{averageCount}</strong>
            <span>平均纪录</span>
          </div>
        </div>

        <section className="weekly-event-section ranking-results-section liaoning-records-table-section">
          <div className="section-header">
            <div>
              <span className="eyebrow">Records</span>
              <h2>{selectedGenderOption.title}</h2>
            </div>
            <div className="ranking-source-line">
              <Database size={16} />
              <span>WCA PostgreSQL</span>
              <span>本站辽宁名单</span>
              <span>{selectedGenderOption.label}</span>
            </div>
          </div>

          <div className="result-table-wrap">
            <table className="result-table liaoning-records-table">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>单次</th>
                  <th>平均</th>
                </tr>
              </thead>
              <tbody>
                {records.map((eventRecord) => (
                  <tr key={eventRecord.eventId}>
                    <td data-label="项目">
                      <strong>{eventRecord.eventNameZh}</strong>
                      <span className="liaoning-record-event-id">{eventRecord.eventId}</span>
                    </td>
                    <td data-label={recordLabel(eventRecord.single)}>
                      <RecordCell record={eventRecord.single} />
                    </td>
                    <td data-label={recordLabel(eventRecord.average)}>
                      <RecordCell record={eventRecord.average} />
                    </td>
                  </tr>
                ))}
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={3}>{dataError || "暂无可展示的辽宁纪录数据，请确认本地名单和 WCA 数据库已同步。"}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </>
  );
}
