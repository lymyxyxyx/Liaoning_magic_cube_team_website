import { PageHero } from "@/components/page-hero";

export default function JudgesPage() {
  return (
    <>
      <PageHero label="人员档案" title="裁判员列表">
        沉淀裁判员执裁经历、规则宣讲和赛事参与记录，让省内赛事资料更容易维护。
      </PageHero>
      <section className="container section">
        <div className="grid">
          <div style={{ textAlign: "center", padding: "40px 20px", gridColumn: "1 / -1" }}>
            <p style={{ color: "#999", fontSize: "16px" }}>裁判员列表待补充</p>
          </div>
        </div>
      </section>
    </>
  );
}
