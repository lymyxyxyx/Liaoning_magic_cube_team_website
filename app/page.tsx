import Image from "next/image";
import Link from "next/link";
import { Trophy } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <section className="split-hero">
        <div className="hero-copy animate-in">
          <span className="eyebrow">辽宁魔方</span>
          <h1>辽宁地区魔方信息查询网</h1>
          <p>
            汇集辽宁地区魔方选手的 WCA 排名、赛事记录、荣誉经历与周赛成绩，为选手、家长和魔方爱好者提供一站式信息查询。
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/liaoning-rankings">
              <Trophy size={18} />
              查看辽宁排名
            </Link>
          </div>
        </div>
        <div className="hero-panel animate-in-delay">
          <Image src="/visuals/home-cube.svg" alt="辽宁地区魔方信息查询网视觉图" width={720} height={540} priority />
        </div>
      </section>
      <div className="container home-entries animate-in-delay-2">
        <Link href="/liaoning-rankings" className="home-entry">
          <strong>辽宁排名</strong>
          <span>按 WCA 官方数据筛选辽宁选手排名</span>
        </Link>
        <Link href="/competitions" className="home-entry">
          <strong>赛事记录</strong>
          <span>沈阳市赛、辽宁省赛、WCA 官方赛事</span>
        </Link>
        <Link href="/weekly" className="home-entry">
          <strong>周赛系统</strong>
          <span>每周训练赛成绩追踪与排名</span>
        </Link>
      </div>
    </>
  );
}
