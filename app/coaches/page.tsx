import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = {
  title: "教练员列表",
  description: "教练库暂未开放，待有明确认证标准后再上线。",
  robots: { index: false, follow: true }
};

export default function CoachesPage() {
  return (
    <>
      <PageHero label="人员档案" title="教练员列表">
        教练员信息暂未开放。
      </PageHero>
      <section className="container section">
        <div className="info-block">
          <h2>教练库暂未开放</h2>
          <p>教练库暂未开放，待有明确认证标准后再上线。</p>
        </div>
      </section>
    </>
  );
}
