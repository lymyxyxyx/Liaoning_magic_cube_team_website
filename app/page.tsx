import Link from "next/link";
import { NewsCard } from "@/components/news-card";
import { getHomeStats } from "@/lib/home-stats";
import { liaoningCityMapPaths } from "@/lib/liaoning-map";
import { getPublishedNews } from "@/lib/news-store";

export const revalidate = 120;

export default async function HomePage() {
  const [news, homeStats] = await Promise.all([getPublishedNews(8), getHomeStats()]);

  return (
    <>
      <div className="hero-band">
        <section className="home-hero animate-in">
          <div className="home-hero-copy">
            <span className="eyebrow">辽宁魔方</span>
            <h1>辽宁地区魔方信息查询网</h1>
            <p>连接辽宁各城市魔方选手，查询排名、纪录、赛事与档案。</p>
            <div className="hero-actions home-hero-actions">
              <Link className="button primary" href="/liaoning-rankings">
                辽宁排名
              </Link>
              <Link className="button home-record-button" href="/liaoning-records">
                辽宁纪录
              </Link>
              <Link className="button home-competition-button" href="/liaoning-competitions">
                辽宁选手参赛纪录
              </Link>
            </div>
          </div>

          <div className="liaoning-unity-card" aria-label="辽宁省各城市行政边界图">
            <div className="liaoning-map-wrap">
              <button className="home-map-stats-trigger" type="button" aria-label="查看辽宁魔方收录数据">
                数据雷达
              </button>
              <svg className="liaoning-map liaoning-admin-map" viewBox="0 0 520 360" role="img">
                <title>辽宁省各城市行政边界示意图</title>
                <g className="liaoning-map-confetti" aria-hidden="true">
                  <rect x="72" y="56" width="13" height="13" rx="3" />
                  <rect x="438" y="212" width="15" height="15" rx="4" />
                  <rect x="168" y="286" width="11" height="11" rx="3" />
                  <circle cx="115" cy="257" r="5" />
                  <circle cx="452" cy="89" r="6" />
                  <circle cx="252" cy="63" r="4" />
                </g>
                <g className="liaoning-map-cities">
                  {liaoningCityMapPaths.map((city, index) => (
                    <path
                      className={`liaoning-map-city liaoning-map-city-${(index % 5) + 1}`}
                      d={city.d}
                      key={city.name}
                    />
                  ))}
                </g>
                <g className="liaoning-map-labels">
                  {liaoningCityMapPaths.map((city) => (
                    <g key={city.name}>
                      <circle cx={city.label[0]} cy={city.label[1]} r="4.5" />
                      <text x={city.label[0]} y={city.label[1] + 18}>
                        {city.name}
                      </text>
                    </g>
                  ))}
                </g>
              </svg>
              <div className="home-map-stats-panel" aria-live="polite">
                <span className="home-map-stats-kicker">辽宁数据雷达</span>
                <strong>{homeStats.playerCount}</strong>
                <span>名选手已收录</span>
                <div className="home-map-leader-grid">
                  <div>
                    <span>男子三速平均第一</span>
                    <b>{homeStats.topMaleAverage?.name || "同步中"}</b>
                    {homeStats.topMaleAverage ? <small>{homeStats.topMaleAverage.result}</small> : null}
                  </div>
                  <div>
                    <span>女子三速平均第一</span>
                    <b>{homeStats.topFemaleAverage?.name || "同步中"}</b>
                    {homeStats.topFemaleAverage ? <small>{homeStats.topFemaleAverage.result}</small> : null}
                  </div>
                </div>
              </div>
            </div>
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
