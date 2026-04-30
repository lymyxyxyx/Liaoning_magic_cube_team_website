import { PersonCard } from "@/components/cards";
import { PageHero } from "@/components/page-hero";
import { getPeopleByRole } from "@/lib/data";
import Link from "next/link";

export default function AthletesPage() {
  const athletes = getPeopleByRole("运动员");

  return (
    <>
      <PageHero label="人员档案" title="运动员列表">
        展示战队运动员的城市、主项、WCA 信息和相关赛事经历。历史成绩可在后续逐步补齐。
      </PageHero>

      {/* 省赛专题信息条 */}
      <section className="container section" style={{ paddingTop: "0" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            padding: "24px",
            borderRadius: "8px",
            marginBottom: "40px"
          }}
        >
          <div style={{ maxWidth: "100%" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "600" }}>
              📌 2026年辽宁省魔方运动公开赛
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "14px", opacity: "0.95" }}>
              <strong>时间：</strong>2026年5月17日（周日）&nbsp;&nbsp;
              <strong>地点：</strong>沈阳市浑南区欧亚长青城
            </p>
            <p style={{ margin: "0 0 16px 0", fontSize: "14px", opacity: "0.95" }}>
              <strong>项目：</strong>二阶、三阶、金字塔、枫叶魔方、三阶镜面、二阶盲拧、三阶盲拧
            </p>
            <p style={{ margin: "0", fontSize: "14px", opacity: "0.9" }}>
              报名时间：2026年4月30日-2026年5月9日&nbsp;
              <a
                href="#"
                style={{
                  color: "#fff",
                  textDecoration: "underline",
                  cursor: "pointer"
                }}
              >
                查看详细竞赛规程
              </a>
            </p>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-header">
          <div>
            <h2>战队运动员</h2>
            <p>共 {athletes.length} 名运动员</p>
          </div>
        </div>
        <div className="grid">
          {athletes.map((person) => (
            <PersonCard person={person} key={person.id} />
          ))}
        </div>
      </section>
    </>
  );
}
