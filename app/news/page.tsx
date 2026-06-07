import { PageHero } from "@/components/page-hero";
import { NewsCard } from "@/components/news-card";
import { getPublishedNews } from "@/lib/news-store";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "新闻动态",
  description: "辽宁地区魔方赛事、成绩、公告与活动的最新动态。",
  alternates: { canonical: "/news" }
};

export default async function NewsPage() {
  const news = await getPublishedNews();

  return (
    <>
      <PageHero label="新闻动态" title="最新动态">
        辽宁地区魔方赛事、成绩、公告与活动的最新消息。
      </PageHero>
      <section className="container section">
        {news.length === 0 ? (
          <div className="news-empty">暂无新闻，敬请期待。</div>
        ) : (
          <div className="news-grid">
            {news.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
