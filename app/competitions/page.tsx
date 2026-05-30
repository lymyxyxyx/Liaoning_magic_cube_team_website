import { PageHero } from "@/components/page-hero";
import { CompetitionsClient } from "./competitions-client";

export default function CompetitionsPage() {
  return (
    <>
      <PageHero label="赛事与活动" title="赛事列表">
        按日期、类别、名称、地点整理辽宁地区赛事记录。
      </PageHero>
      <CompetitionsClient />
    </>
  );
}
