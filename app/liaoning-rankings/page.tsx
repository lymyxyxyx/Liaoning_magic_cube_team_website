import type { Metadata } from "next";
import { LiaoningRankingsClient } from "./liaoning-rankings-client";

export const metadata: Metadata = {
  title: "辽宁排名",
  description: "辽宁地区魔方选手的 WCA 单次与平均成绩排名，可按项目、城市、性别筛选查询。",
  alternates: { canonical: "/liaoning-rankings" },
  openGraph: {
    type: "website",
    url: "/liaoning-rankings",
    title: "辽宁排名",
    description: "辽宁地区魔方选手的 WCA 单次与平均成绩排名。"
  }
};

export default function LiaoningRankingsPage() {
  return <LiaoningRankingsClient />;
}
