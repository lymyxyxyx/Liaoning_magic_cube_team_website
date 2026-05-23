import { PageHero } from "@/components/page-hero";

export default function AthletesPage() {
  return (
    <>
      <PageHero label="人员档案" title="运动员列表">
        运动员资料待补充。
      </PageHero>

      <section className="container section">
        <div className="grid">
          <div style={{ textAlign: "center", padding: "40px 20px", gridColumn: "1 / -1" }}>
            <p style={{ color: "#999", fontSize: "16px" }}>运动员列表待补充</p>
          </div>
        </div>
      </section>
    </>
  );
}
