import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { AboutFeedbackForm } from "./about-feedback-form";

export const metadata: Metadata = {
  title: "关于本站",
  description: "辽宁地区魔方信息查询网的定位、数据来源、更新频率、纠错反馈与联系方式。"
};

const infoBlocks = [
  {
    title: "非官方说明",
    text: "本站由辽宁地区魔方爱好者维护，不是 WCA 官方网站，也不代表 WCA、赛事主办方或任何官方认证机构。正式成绩、赛事资格和规则解释请以 WCA 官方网站及比赛公告为准。"
  },
  {
    title: "数据来源",
    text: "WCA 成绩、赛事、排名等信息主要来自 WCA 官方公开数据和公开赛事页面；本地选手档案、周赛、裁判信息和活动资料可能来自公开记录、现场活动记录、相关组织提供或管理员后台录入。"
  },
  {
    title: "更新频率",
    text: "公开 WCA 数据会根据可用数据源不定期同步；本地资料、周赛记录、新闻和名单信息由管理员按活动进展维护。历史资料允许阶段性不完整，发现问题欢迎反馈。"
  },
  {
    title: "隐私与展示范围",
    text: "本站尽量只展示与魔方活动直接相关、对查询有必要的信息。涉及未成年人、联系方式、敏感身份信息或不适合公开展示的内容，可申请隐藏、删除或调整展示方式。"
  }
];

export default function AboutPage() {
  return (
    <>
      <PageHero label="关于本站" title="关于辽宁地区魔方信息查询网">
        本站汇总辽宁地区魔方选手、排名、赛事活动与荣誉经历等资料，方便选手、家长和魔方爱好者查询、核对与补充信息。
      </PageHero>
      <section className="container section">
        <div className="grid two">
          {infoBlocks.map((item) => (
            <div className="info-block" key={item.title}>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="container section">
        <div className="local-eligibility-card">
          <div>
            <span className="eyebrow">Feedback</span>
            <h2>纠错、隐藏与补充资料</h2>
            <ol>
              <li>如果姓名、地区、WCA ID、成绩归属或页面内容有误，请提交反馈说明。</li>
              <li>如果本人或监护人希望隐藏、删除非必要展示信息，请选择“删除/隐藏请求”。</li>
              <li>公开赛事成绩的原始数据以 WCA 等第三方公开数据源为准，本站可调整本站展示方式。</li>
            </ol>
            <p>
              详细的数据展示原则可查看 <Link href="/privacy">隐私说明</Link>。
            </p>
            <p>
              复杂或紧急事项可联系管理员微信：<strong>SteveNovak1998</strong>，添加时请备注“辽宁魔方网站反馈”。
            </p>
          </div>
          <AboutFeedbackForm />
        </div>
      </section>
    </>
  );
}
