import Link from "next/link";
import { NewsCard } from "@/components/news-card";
import { getHomeStats } from "@/lib/home-stats";
import { liaoningCityMapPaths } from "@/lib/liaoning-map";
import { getPublishedNews } from "@/lib/news-store";

export const revalidate = 120;

const cityMarkerOffsets: Record<string, [number, number]> = {
  鞍山: [-14, 2],
  辽阳: [18, -4],
  盘锦: [0, 14],
  锦州: [-8, -10]
};

export default async function HomePage() {
  const [news, homeStats] = await Promise.all([getPublishedNews(8), getHomeStats()]);
  const cityStatsByName = new Map(homeStats.cities.map((city) => [city.city, city]));

  return (
    <>
      <div className="hero-band">
        <section className="home-hero animate-in">
          <div className="home-hero-copy">
            <span className="eyebrow">辽宁魔方</span>
            <h1>辽宁魔方信息库</h1>
            <p>排名、纪录、赛事与选手档案，一站查询。</p>
            <div className="hero-actions home-hero-actions">
              <Link className="button primary" href="/liaoning-rankings">
                辽宁排名
              </Link>
              <Link className="button home-record-button" href="/liaoning-records">
                辽宁纪录
              </Link>
              <Link className="button home-person-button" href="/person">
                辽宁选手
              </Link>
              <Link className="button home-competition-button" href="/liaoning-competitions">
                辽宁选手参赛记录
              </Link>
            </div>
          </div>

          <div className="liaoning-unity-card" aria-label="辽宁省各城市行政边界图">
            <div className="liaoning-map-wrap">
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
              <div className="home-city-markers" aria-label={`已收录 ${homeStats.playerCount} 名有 WCA ID 的辽宁选手`}>
                {liaoningCityMapPaths.map((city) => {
                  const stats = cityStatsByName.get(city.name);
                  const markerOffset = cityMarkerOffsets[city.name] || [0, 0];
                  const x = `${((city.label[0] + markerOffset[0]) / 520) * 100}%`;
                  const y = `${((city.label[1] + markerOffset[1]) / 360) * 100}%`;

                  return (
                    <button
                      className="home-city-marker"
                      type="button"
                      key={city.name}
                      style={{ left: x, top: y }}
                      aria-label={`${city.name}，${stats?.playerCount || 0} 名选手，男子第一 ${stats?.topMaleAverage?.name || "暂无"}，女子第一 ${stats?.topFemaleAverage?.name || "暂无"}`}
                    >
                      <span className="home-city-marker-title">{city.name}</span>
                      <span className="home-city-marker-count">{stats?.playerCount || 0}人</span>
                      <span className="home-city-popover">
                        <b>{city.name}</b>
                        <span>{stats?.playerCount || 0} 名选手</span>
                        <small>男 {stats?.topMaleAverage ? `${stats.topMaleAverage.name} ${stats.topMaleAverage.result}` : "暂无"}</small>
                        <small>女 {stats?.topFemaleAverage ? `${stats.topFemaleAverage.name} ${stats.topFemaleAverage.result}` : "暂无"}</small>
                      </span>
                    </button>
                  );
                })}
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
