import Image from "next/image";
import Link from "next/link";
import { Trophy } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <div className="hero-band">
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
      </div>
      <div className="container home-entries animate-in-delay-2">
        <Link href="/liaoning-rankings" className="home-entry">
          <strong>辽宁排名</strong>
          <span>辽宁选手 WCA 单次与平均成绩排名</span>
        </Link>
        <Link href="/liaoning-records" className="home-entry">
          <strong>辽宁纪录</strong>
          <span>各 WCA 项目辽宁单次与平均纪录</span>
        </Link>
        <Link href="/liaoning-competitions" className="home-entry">
          <strong>辽宁 WCA 赛事</strong>
          <span>辽宁选手参加的 WCA 正式比赛，随官方数据同步</span>
        </Link>
        <Link href="/weekly" className="home-entry">
          <strong>周赛</strong>
          <span>每周魔方周赛成绩、个人最好与排名</span>
        </Link>
        <Link href="/judges" className="home-entry">
          <strong>裁判信息</strong>
          <span>辽宁地区 WCA 裁判编号、级别与培训</span>
        </Link>
        <Link href="/commercial-teams" className="home-entry">
          <strong>商业战队成员</strong>
          <span>GAN、魔域、魔方格等品牌赞助战队成员</span>
        </Link>
      </div>
    </>
  );
}
