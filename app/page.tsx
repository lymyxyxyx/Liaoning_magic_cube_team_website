import Image from "next/image";
import Link from "next/link";
import { Trophy } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <section className="split-hero">
        <div className="hero-copy">
          <span className="eyebrow">辽宁地区魔方数据与资料查询</span>
          <h1>辽宁地区魔方信息查询网</h1>
          <p>
            本网站为辽宁地区魔方玩家建立魔方信息查询平台，汇总魔方选手、排名、赛事活动、荣誉经历等资料，让选手、家长、合作单位和魔方爱好者都能清楚查询本地魔方信息。
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/liaoning-rankings">
              <Trophy size={18} />
              查看辽宁排名
            </Link>
          </div>
        </div>
        <div className="hero-panel">
          <Image src="/visuals/home-cube.svg" alt="辽宁地区魔方信息查询网视觉图" width={720} height={540} priority />
        </div>
      </section>
    </>
  );
}
