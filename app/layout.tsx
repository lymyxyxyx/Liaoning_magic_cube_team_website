import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lncubing.com"),
  title: "辽宁地区魔方信息查询网",
  description:
    "辽宁地区魔方信息查询网目前为测试阶段的非官方资料整理页面，站内信息主要依据公开资料和人工采集整理，仅供查询参考。"
};

export const viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteHeader />
        <main>{children}</main>
        <footer className="site-footer">
          <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer">
            辽ICP备2026010407号-1
          </a>
        </footer>
      </body>
    </html>
  );
}
