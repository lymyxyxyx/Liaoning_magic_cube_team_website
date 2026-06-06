import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { getLiaoningCompetitions } from "@/lib/liaoning-competitions";
import { LiaoningCompetitionsClient } from "./liaoning-competitions-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "辽宁 WCA 赛事",
  description: "辽宁选手参加过的 WCA 正式比赛列表，依据 WCA 同步数据自动生成，含日期、城市与参赛选手。",
  alternates: { canonical: "/liaoning-competitions" },
  openGraph: {
    type: "website",
    url: "/liaoning-competitions",
    title: "辽宁 WCA 赛事",
    description: "辽宁选手参加过的 WCA 正式比赛列表，随官方数据同步更新。"
  }
};

export default async function LiaoningCompetitionsPage() {
  const competitions = await getLiaoningCompetitions();

  return (
    <>
      <PageHero label="赛事与活动" title="辽宁 WCA 赛事" className="competition-page-hero">
        辽宁选手参加 WCA 正式比赛的赛事足迹与参赛统计，数据随 WCA 官方数据同步更新。
      </PageHero>
      <LiaoningCompetitionsClient initialCompetitions={competitions} />
    </>
  );
}
