import { PageHero } from "@/components/page-hero";

const principles = ["先做小，不做大而全", "历史资料允许不完整", "前期不开放普通用户注册", "优先沉淀人员、赛事和荣誉"];

export default function AboutPage() {
  return (
    <>
      <PageHero label="项目共识" title="关于辽宁魔方战队网站">
        第一阶段定位为公开展示官网与基础档案库，重点解决“有哪些人”“有哪些赛事活动”“资料如何持续补充”三个问题。
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
