import { PageHero } from "@/components/page-hero";
import { CompetitionsClient } from "./competitions-client";

export default function CompetitionsPage() {
  return (
    <>
      <PageHero label="赛事与活动" title="赛事列表">
        按日期、比赛类别、名称、省份、城市和地点整理赛事，后续可继续补充规程、项目、成绩和相关人员。
      </PageHero>
      <CompetitionsClient />
    </>
  );
}
