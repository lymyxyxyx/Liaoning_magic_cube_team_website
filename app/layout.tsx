import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const siteName = "辽宁地区魔方信息查询网";
const siteDescription =
  "辽宁地区魔方信息查询网汇集辽宁地区魔方选手、排名、赛事活动与荣誉经历等资料，供选手、家长和魔方爱好者查询参考。";

export const metadata: Metadata = {
  metadataBase: new URL("https://lncubing.com"),
  title: {
    default: siteName,
    template: `%s | ${siteName}`
  },
  description: siteDescription,
  applicationName: siteName,
  keywords: ["辽宁魔方", "沈阳魔方", "魔方", "WCA", "辽宁排名", "辽宁纪录", "魔方比赛", "魔方周赛", "速拧"],
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    siteName,
    locale: "zh_CN",
    url: "/",
    title: siteName,
    description: siteDescription
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={GeistSans.className}>
        <SiteHeader />
        <main>{children}</main>
        <footer className="site-footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <strong>辽宁地区魔方信息查询网</strong>
              <span>汇集辽宁地区魔方选手的排名、赛事与档案信息</span>
            </div>
            <nav className="footer-nav" aria-label="底部导航">
              <Link href="/liaoning-rankings">辽宁排名</Link>
              <Link href="/competitions">赛事记录</Link>
              <Link href="/weekly">周赛系统</Link>
              <Link href="/judges">裁判员名单</Link>
              <Link href="/about">关于本站</Link>
            </nav>
            <div className="footer-meta">
              <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer">
                辽ICP备2026010407号-1
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
