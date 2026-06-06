import { PageHero } from "@/components/page-hero";
import { getLiaoningCompetitions } from "@/lib/liaoning-competitions";
import { LiaoningCompetitionsClient } from "./liaoning-competitions-client";

export const dynamic = "force-dynamic";

export default async function LiaoningCompetitionsPage() {
  const competitions = await getLiaoningCompetitions();

  return (
    <>
      <PageHero label="赛事与活动" title="辽宁 WCA 赛事" className="competition-page-hero">
        根据 WCA 同步数据自动生成：辽宁选手参加过的 WCA 正式比赛，按日期排列，随官方数据更新。
      </PageHero>
      <LiaoningCompetitionsClient initialCompetitions={competitions} />
    </>
  );
}
