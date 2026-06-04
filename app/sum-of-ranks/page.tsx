import { PageHero } from "@/components/page-hero";
import { SumOfRanksClient } from "./sum-of-ranks-client";

export default function SumOfRanksPage() {
  return (
    <>
      <PageHero className="ranking-page-hero" label="WCA 综合统计" title="综合排名">
        按各项目排名汇总，缺项自动计入。
      </PageHero>
      <SumOfRanksClient />
    </>
  );
}
