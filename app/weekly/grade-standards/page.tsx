import Link from "next/link";
import { PageHero } from "@/components/page-hero";

const columns = ["金字塔", "三阶", "二阶", "斜转", "四阶", "五阶", "二盲", "三盲", "枫叶", "镜面", "火山魔塔", "REDI", "二重奏"];
type Row = { level: string; stars: string; values: string[]; tone: "master" | "expert" | "pro" | "advanced" | "intermediate" | "beginner" };
const rows: Row[] = [
  { level: "特级大师", stars: "★★★★", tone: "master", values: ["<3", "<8", "<3", "<3", "<30", "<60", "<15", "<60", "<2", "<10", "<1", "<6", "<1"] },
  { level: "", stars: "★★★", tone: "master", values: ["<4", "<9", "<4", "<5", "<32", "<62", "<20", "<80", "<3", "<12", "<2", "<8", "<2"] },
  { level: "", stars: "★★", tone: "master", values: ["<5", "<10", "<5", "<7", "<34", "<65", "<25", "<100", "<4", "<15", "<3", "<10", "<3"] },
  { level: "", stars: "★", tone: "master", values: ["<6", "<12", "<6", "<9", "<38", "<70", "<30", "<120", "<5", "<18", "<4", "<12", "<4"] },
  { level: "大师级", stars: "★★★★", tone: "expert", values: ["<8", "<14", "<7", "<12", "<45", "<75", "<40", "<140", "<6", "<22", "<6", "<15", "<6"] },
  { level: "", stars: "★★★", tone: "expert", values: ["<10", "<16", "<8", "<14", "<48", "<80", "<60", "<160", "<8", "<26", "<7", "<18", "<7"] },
  { level: "", stars: "★★", tone: "expert", values: ["<12", "<18", "<9", "<16", "<52", "<85", "<100", "<180", "<10", "<30", "<8", "<20", "<8"] },
  { level: "", stars: "★", tone: "expert", values: ["<14", "<20", "<10", "<18", "<55", "<90", "<150", "<200", "<12", "<35", "<9", "<22", "<9"] },
  { level: "专业级", stars: "★★★★", tone: "pro", values: ["<16", "<22", "<12", "<20", "<60", "<150", "<250", "<250", "<15", "<40", "<10", "<25", "<10"] },
  { level: "", stars: "★★★", tone: "pro", values: ["<18", "<25", "<14", "<25", "<120", "<300", "<300", "<300", "<18", "<50", "<12", "<28", "<12"] },
  { level: "", stars: "★★", tone: "pro", values: ["<20", "<30", "<16", "<30", "<180", "<400", "<350", "<400", "<20", "<60", "<13", "<30", "<13"] },
  { level: "", stars: "★", tone: "pro", values: ["<25", "<35", "<18", "<40", "<240", "<400", "<400", "<400", "<22", "<70", "<14", "<35", "<14"] },
  { level: "高手级", stars: "★★★★", tone: "advanced", values: ["<26", "<40", "<20", "<60", "<300", "<600", "—", "—", "<25", "<80", "<15", "<40", "<15"] },
  { level: "", stars: "★★★", tone: "advanced", values: ["<30", "<50", "<22", "<70", "<400", "—", "—", "—", "<30", "<100", "<20", "<50", "<20"] },
  { level: "", stars: "★★", tone: "advanced", values: ["<35", "<60", "<22", "<80", "<500", "—", "—", "—", "<35", "<120", "<25", "<60", "<25"] },
  { level: "", stars: "★", tone: "advanced", values: ["<40", "<65", "<23", "<90", "<600", "—", "—", "—", "<40", "<150", "<30", "<80", "<30"] },
  { level: "中级", stars: "★★★★", tone: "intermediate", values: ["<50", "<60", "<30", "<100", "—", "—", "—", "—", "<50", "<180", "<40", "<90", "<40"] },
  { level: "", stars: "★★★", tone: "intermediate", values: ["<60", "<70", "<50", "<120", "—", "—", "—", "—", "<60", "<200", "<50", "<120", "<50"] },
  { level: "", stars: "★★", tone: "intermediate", values: ["<70", "<80", "<60", "<300", "—", "—", "—", "—", "<90", "<240", "<60", "<150", "<60"] },
  { level: "", stars: "★", tone: "intermediate", values: ["<80", "<120", "<70", "<600", "—", "—", "—", "—", "<120", "<300", "<90", "<180", "<90"] },
  { level: "初级", stars: "★★★★", tone: "beginner", values: ["<90", "<150", "<90", "<300", "—", "—", "—", "—", "—", "—", "—", "—", "—"] },
  { level: "", stars: "★★★", tone: "beginner", values: ["<120", "<180", "<120", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"] },
  { level: "", stars: "★★", tone: "beginner", values: ["<300", "<300", "<300", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"] },
  { level: "", stars: "★", tone: "beginner", values: ["<600", "<600", "<600", "—", "—", "—", "—", "—", "—", "—", "—", "—", "—"] }
];

export default function WeeklyGradeStandardsPage() {
  return <><PageHero className="weekly-grade-page-hero" label="辽宁线上周赛" title="竞速运动技能等级标准" actions={<Link className="button" href="/weekly">返回周赛</Link>}>沈阳市魔方运动协会竞速运动技能等级测评标准。项目单位：秒（s）；成绩需小于表中数值。</PageHero><section className="container section weekly-grade-page"><div className="weekly-grade-note"><strong>查询说明</strong><span>每个项目按平均成绩判定段位与星级；“—”表示该段位未设该项目标准。</span></div><div className="weekly-grade-table-wrap"><table className="weekly-grade-table"><thead><tr><th>段位 / 称号</th><th>等级</th>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr className={`weekly-grade-row weekly-grade-row--${row.tone}`} key={`${row.level}-${row.stars}-${index}`}><td>{row.level}</td><td>{row.stars}</td>{row.values.map((value, valueIndex) => <td key={valueIndex}>{value}</td>)}</tr>)}</tbody></table></div><p className="weekly-grade-footnote">标准来源：沈阳市魔方运动协会竞速运动技能等级测评标准。</p></section></>;
}
