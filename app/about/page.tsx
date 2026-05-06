import { PageHero } from "@/components/page-hero";

const principles = ["先做小，不做大而全", "历史资料允许不完整", "前期不开放普通用户注册", "优先沉淀人员、赛事和荣誉"];

export default function AboutPage() {
  return (
    <>
      <PageHero label="项目共识" title="关于辽宁地区魔方信息查询网">
        本网站为辽宁地区魔方玩家建立魔方信息查询平台，汇总魔方选手、排名、赛事活动、荣誉经历等资料，让选手、家长、合作单位和魔方爱好者都能清楚查询本地魔方信息。
      </PageHero>
      <section className="container section">
        <div className="grid two">
          {principles.map((item) => (
            <div className="info-block" key={item}>
              <h2>{item}</h2>
              <p>第一版围绕上线可用、信息清晰和后续可维护展开，复杂平台能力留到后续版本迭代。</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
