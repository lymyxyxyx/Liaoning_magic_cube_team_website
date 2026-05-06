import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "辽宁地区魔方信息查询网",
  description:
    "本网站为辽宁地区魔方玩家建立魔方信息查询平台，汇总魔方选手、排名、赛事活动、荣誉经历等资料，让选手、家长、合作单位和魔方爱好者都能清楚查询本地魔方信息。"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
