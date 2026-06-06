import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { CompetitionsClient } from "./competitions-client";

export const metadata: Metadata = {
  title: "赛事列表",
  description: "辽宁地区魔方赛事记录，含沈阳市赛、辽宁省赛与 WCA 官方赛事，可按日期、类别、名称、地点查询。",
  alternates: { canonical: "/competitions" },
  openGraph: {
    type: "website",
    url: "/competitions",
    title: "赛事列表",
    description: "辽宁地区魔方赛事记录：市赛、省赛与 WCA 官方赛事。"
  }
};

export default function CompetitionsPage() {
  return (
    <>
      <PageHero label="赛事与活动" title="赛事列表" className="competition-page-hero">
        按日期、类别、名称、地点整理辽宁地区赛事记录。
      </PageHero>
      <CompetitionsClient />
    </>
  );
}
