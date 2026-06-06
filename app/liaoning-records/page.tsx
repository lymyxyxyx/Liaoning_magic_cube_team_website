import Link from "next/link";
import { Database, Trophy } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import type { Metadata } from "next";
import { getLiaoningRecords, type LocalRecordEvent, type LocalRecordGender, type LocalRecordResult } from "@/lib/local-records";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "辽宁纪录",
  description: "辽宁地区各 WCA 项目的单次与平均纪录，含保持者、成绩、比赛与日期，支持男女分组查询。",
  alternates: { canonical: "/liaoning-records" },
  openGraph: {
    type: "website",
    url: "/liaoning-records",
    title: "辽宁纪录",
    description: "辽宁地区各 WCA 项目的单次与平均纪录，含保持者、成绩与比赛信息。"
  }
};

const genderOptions: { value: LocalRecordGender; label: string; title: string }[] = [
  { value: "all", label: "不限", title: "当前辽宁纪录" },
  { value: "m", label: "男子", title: "当前辽宁男子纪录" },
  { value: "f", label: "女子", title: "当前辽宁女子纪录" }
];

function recordLabel(record: LocalRecordResult | undefined) {
  if (!record) return "暂无";
  return record.mode === "single" ? "单次纪录" : "平均纪录";
}

function createMockRecord(overrides: Partial<LocalRecordResult>): LocalRecordResult {
  return {
    mode: "single",
    value: "",
    personName: "",
    wcaId: "",
    gender: "m",
    province: "辽宁",
    city: "沈阳",
    worldRank: 0,
    countryRank: 0,
    competitionId: "",
    competitionName: "",
    competitionNameZh: "",
    date: "2026-06-03",
    attempts: [],
    ...overrides
  };
}

const mockRecords: LocalRecordEvent[] = [
  {
    eventId: "333",
    eventName: "3x3x3 Cube",
    eventNameZh: "3x3x3 Cube（三阶魔方）",
    eventRank: 10,
    single: createMockRecord({ mode: "single", value: "4.59", personName: "Zhaokun Li（李昭昆）", wcaId: "2024LIZH03", city: "沈阳", worldRank: 6, countryRank: 3 }),
    average: createMockRecord({ mode: "average", value: "5.88", personName: "Minghao Chen（陈明昊）", wcaId: "2023LIAO01", city: "沈阳", worldRank: 18, countryRank: 6 })
  },
  {
    eventId: "222",
    eventName: "2x2x2 Cube",
    eventNameZh: "2x2x2 Cube（二阶魔方）",
    eventRank: 20,
    single: createMockRecord({ mode: "single", value: "1.28", personName: "Yue Zhao（赵悦）", wcaId: "2022DALI01", gender: "f", city: "大连", worldRank: 42, countryRank: 11 }),
    average: createMockRecord({ mode: "average", value: "2.06", personName: "Jinyi Sun（孙锦一）", wcaId: "2025FUSH01", city: "抚顺", worldRank: 61, countryRank: 15 })
  },
  {
    eventId: "444",
    eventName: "4x4x4 Cube",
    eventNameZh: "4x4x4 Cube（四阶魔方）",
    eventRank: 30,
    single: createMockRecord({ mode: "single", value: "20.76", personName: "Haoran Lin（林浩然）", wcaId: "2021ANSH01", city: "鞍山", worldRank: 76, countryRank: 19 }),
    average: createMockRecord({ mode: "average", value: "24.63", personName: "Zhaokun Li（李昭昆）", wcaId: "2024LIZH03", city: "沈阳", worldRank: 88, countryRank: 24 })
  },
  {
    eventId: "333oh",
    eventName: "3x3x3 One-Handed",
    eventNameZh: "3x3x3 One-Handed（单手）",
    eventRank: 70,
    single: createMockRecord({ mode: "single", value: "7.21", personName: "Minghao Chen（陈明昊）", wcaId: "2023LIAO01", city: "沈阳", worldRank: 38, countryRank: 9 }),
    average: createMockRecord({ mode: "average", value: "9.42", personName: "Yue Zhao（赵悦）", wcaId: "2022DALI01", gender: "f", city: "大连", worldRank: 94, countryRank: 21 })
  },
  {
    eventId: "pyram",
    eventName: "Pyraminx",
    eventNameZh: "Pyraminx（金字塔）",
    eventRank: 110,
    single: createMockRecord({ mode: "single", value: "2.18", personName: "Jinyi Sun（孙锦一）", wcaId: "2025FUSH01", city: "抚顺", worldRank: 103, countryRank: 28 }),
    average: createMockRecord({ mode: "average", value: "3.11", personName: "Haoran Lin（林浩然）", wcaId: "2021ANSH01", city: "鞍山", worldRank: 136, countryRank: 33 })
  }
];

function getMockRecords(gender: LocalRecordGender) {
  if (gender === "all") return mockRecords;
  return mockRecords
    .map((eventRecord) => ({
      ...eventRecord,
      single: eventRecord.single?.gender === gender ? eventRecord.single : undefined,
      average: eventRecord.average?.gender === gender ? eventRecord.average : undefined
    }))
    .filter((eventRecord) => eventRecord.single || eventRecord.average);
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
        <strong>{record.value}</strong>
        <span className="liaoning-record-badge">{record.mode === "single" ? "单次" : "平均"}</span>
      </div>
      <Link className="liaoning-record-person" href={`https://cubing.com/results/person/${record.wcaId}`} referrerPolicy="no-referrer" rel="noopener noreferrer" target="_blank">
        {record.personName}
      </Link>
      <span className="liaoning-record-meta">
        {record.city || "辽宁"} {record.date ? `· ${record.date}` : ""}
      </span>
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
  const shouldUseMockRecords = process.env.NODE_ENV === "development" && records.length === 0;
  const displayRecords = shouldUseMockRecords ? getMockRecords(selectedGender) : records;

  return (
    <>
      <PageHero
        className="ranking-page-hero local-ranking-page-hero"
        label="本地省市归属"
        title="辽宁纪录"
        actions={
          <Link className="button primary" href="/liaoning-rankings">
            <Trophy size={16} />
            辽宁排名
          </Link>
        }
      >
        展示辽宁选手各项目当前最好单次与平均。
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

        <section className="weekly-event-section ranking-results-section liaoning-records-table-section">
          <div className="section-header">
            <div>
              <span className="eyebrow">Records</span>
              <h2>{selectedGenderOption.title}</h2>
            </div>
            <div className="ranking-source-line">
              <Database size={16} />
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
                {displayRecords.map((eventRecord) => (
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
                {displayRecords.length === 0 ? (
                  <tr>
                    <td colSpan={3}>{dataError || "暂无可展示的辽宁纪录数据。"}</td>
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
