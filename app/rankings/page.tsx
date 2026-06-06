import type { Metadata } from "next";
import { RankingsClient } from "./rankings-client";

export const metadata: Metadata = {
  title: "WCA 排名",
  description: "基于本地同步的 WCA 官方数据，按项目、国家/地区、单次/平均与性别查询世界与各地排名。",
  alternates: { canonical: "/rankings" },
  openGraph: {
    type: "website",
    url: "/rankings",
    title: "WCA 排名",
    description: "基于 WCA 官方数据的项目、地区、单次/平均排名查询。"
  }
};

export default function RankingsPage() {
  return <RankingsClient />;
}
