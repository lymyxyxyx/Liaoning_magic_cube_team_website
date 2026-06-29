import Link from "next/link";
import { NewsCard } from "@/components/news-card";
import { getPublishedNews } from "@/lib/news-store";

export const revalidate = 120;

export default async function HomePage() {
  const news = await getPublishedNews(8);

  return (
    <>
      <div className="hero-band">
        <section className="hero-copy home-hero animate-in">
          <span className="eyebrow">辽宁魔方</span>
          <h1>辽宁地区魔方信息查询网</h1>
          <p>排名、纪录、赛事、周赛与档案，一站式查询。</p>
          <div className="hero-actions">
            <Link className="button primary" href="/liaoning-rankings">
              辽宁排名
            </Link>
            <Link className="button" href="/liaoning-records">
              辽宁纪录
            </Link>
          </div>
        </section>
      </div>
      {news.length > 0 ? (
        <section className="container section home-news animate-in-delay-2" aria-label="新闻动态">
          <div className="home-news-head">
            <span className="eyebrow">新闻动态</span>
            <Link href="/news" className="home-news-more">
              查看全部 →
            </Link>
          </div>
          <div className="news-list">
            {news.map((item) => (
              <NewsCard key={item.id} item={item} row />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
