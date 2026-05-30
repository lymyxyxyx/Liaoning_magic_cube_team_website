import { PageHero } from "@/components/page-hero";
import { SumOfRanksClient } from "./sum-of-ranks-client";

export default function SumOfRanksPage() {
  return (
    <>
      <PageHero className="ranking-page-hero" label="WCA 综合统计" title="综合排名">
        按 WCA 当前项目汇总每位选手在各项目中的排名，缺项按当前范围内该项目最差排名后一位计入。
      </PageHero>
      <SumOfRanksClient />
    </>
  );
}
