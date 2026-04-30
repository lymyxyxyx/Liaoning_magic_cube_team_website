import { PageHero } from "@/components/page-hero";

export default function CoachesPage() {
  return (
    <>
      <PageHero label="人员档案" title="教练员列表">
        记录战队老师、培训方向、赛事带队和集训活动，为后续课程体系资料沉淀打底。
      </PageHero>
      <section className="container section">
        <div className="grid">
          <div style={{ textAlign: "center", padding: "40px 20px", gridColumn: "1 / -1" }}>
            <p style={{ color: "#999", fontSize: "16px" }}>教练员列表待补充</p>
          </div>
        </div>
      </section>
    </>
  );
}
