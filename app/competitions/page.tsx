import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { getEventList } from "@/lib/event-list";
import { CompetitionsClient } from "./competitions-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "赛事列表",
  description: "辽宁地区魔方赛事一站式查询：WCA、省赛、市赛与国赛信息，可按类别、名称、地点检索。",
  alternates: { canonical: "/competitions" },
  openGraph: {
    type: "website",
    url: "/competitions",
    title: "赛事列表",
    description: "辽宁地区魔方赛事一站式查询：WCA、省赛、市赛与国赛。"
  }
};

export default async function CompetitionsPage() {
  const events = await getEventList();

  return (
    <>
      <PageHero label="赛事与活动" title="赛事列表" className="competition-page-hero">
        汇总 WCA、省赛、市赛与国赛信息，可按类别、名称、地点检索。
      </PageHero>
      <CompetitionsClient initialEvents={events} />
    </>
  );
}
