import Image from "next/image";
import Link from "next/link";
import { CalendarDays, UsersRound } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <section className="split-hero">
        <div className="hero-copy">
          <span className="eyebrow">公开展示官网与基础档案库</span>
          <h1>辽宁魔方战队</h1>
          <p>
            先把战队人员、赛事活动、荣誉经历和资料整理状态沉淀下来，让成员、家长、合作单位和魔方爱好者都能清楚了解辽宁魔方的发展脉络。
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
          <Image src="/visuals/home-cube.svg" alt="辽宁魔方战队视觉图" width={720} height={540} priority />
        </div>
      </section>
    </>
  );
}
