import Image from "next/image";
import Link from "next/link";
import { Trophy } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <section className="split-hero">
        <div className="hero-copy">
          <span className="eyebrow">测试版 · 非官方资料整理</span>
          <h1>辽宁地区魔方信息查询网</h1>
          <p>
            本网站目前为测试阶段的信息整理页面，并非官方对外发布渠道。站内排名、赛事、人员与荣誉等内容主要依据公开资料和人工采集整理，仅供辽宁地区魔方爱好者查询参考；如与官方公告或 WCA 数据不一致，请以官方发布为准。
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
