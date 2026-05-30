import { PageHero } from "@/components/page-hero";

export default function AthletesPage() {
  return (
    <>
      <PageHero label="人员档案" title="运动员列表">
        运动员资料整理中，后续将按 WCA ID 关联个人主页。
      </PageHero>

      <section className="container section">
        <div className="competition-empty">
          <strong>暂无数据</strong>
          <p>运动员列表待补充。</p>
        </div>
      </section>
    </>
  );
}
