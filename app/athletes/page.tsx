import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = {
  title: "运动员列表",
  description: "运动员信息暂未开放。",
  robots: { index: false, follow: true }
};

export default function AthletesPage() {
  return (
    <>
      <PageHero label="人员档案" title="运动员列表">
        运动员信息暂未开放。
      </PageHero>
      <section className="container section">
        <div className="info-block">
          <h2>运动员暂未开放</h2>
          <p>本站目前只维护“选手”概念，暂无独立的“运动员”体系，该页面待相关标准明确后再上线。</p>
        </div>
      </section>
    </>
  );
}
