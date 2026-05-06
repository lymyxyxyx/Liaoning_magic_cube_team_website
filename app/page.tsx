import Image from "next/image";
import Link from "next/link";
import { CalendarDays, UsersRound } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <section className="split-hero">
        <div className="hero-copy">
          <span className="eyebrow">辽宁地区魔方数据与资料查询</span>
          <h1>辽宁地区魔方信息查询网</h1>
          <p>
            汇总辽宁地区魔方选手、WCA 排名、赛事活动、荣誉经历和资料整理状态，让选手、家长、合作单位和魔方爱好者都能清楚查询本地魔方信息。
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/athletes">
              <UsersRound size={18} />
              查看人员档案
            </Link>
            <Link className="button" href="/competitions">
              <CalendarDays size={18} />
              查看赛事活动
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
