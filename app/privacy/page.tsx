import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = {
  title: "隐私说明",
  description: "辽宁地区魔方信息查询网的数据来源、展示范围、反馈更正方式与访问统计说明。"
};

const policySections = [
  {
    title: "数据来源",
    items: [
      "WCA 成绩、赛事和排名主要来自 WCA 官方公开数据及公开赛事页面。",
      "本地档案、周赛、裁判和战队资料可能来自公开资料、活动记录、相关组织、本人反馈或管理员录入。"
    ]
  },
  {
    title: "展示范围",
    items: [
      "公开页面只展示与魔方活动相关的信息，例如姓名、WCA ID、地区、成绩、赛事记录、荣誉经历和公开身份。",
      "本站不主动公开身份证号、手机号、微信号、详细住址、后台口令等敏感信息；涉及未成年人时，会尽量减少非必要展示。"
    ]
  },
  {
    title: "反馈、更正与删除",
    items: [
      "姓名、城市、身份、成绩归属等信息如有错误，可通过反馈入口或管理员联系方式申请更正。",
      "本人、监护人或相关组织可申请隐藏、删除或调整非必要展示信息；第三方平台原始数据需向对应平台处理。"
    ]
  },
  {
    title: "访问统计",
    items: [
      "本站不接入第三方广告或跨站追踪脚本。",
      "自有访问统计仅用于后台查看访问量、页面路径、基础设备类型、访问 IP 及其粗略省市归属；记录访问时间与 User-Agent，不公开单个访问者记录。"
    ]
  },
  {
    title: "后台与更新",
    items: [
      "后台资料仅供网站维护使用，不作为官方身份或赛事认证依据。",
      "网站功能和数据范围调整时，本说明可能同步更新。",
      "最近更新日期：2026 年 7 月 12 日。"
    ]
  }
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero label="隐私说明" title="本站如何使用和展示资料">
        本站用于查询公开赛事、排名、周赛与本地魔方活动资料。这里简要说明数据来源、展示范围和更正删除方式。
      </PageHero>
      <section className="container section">
        <div className="section-header">
          <div>
            <span className="eyebrow">Privacy</span>
            <h2>资料处理原则</h2>
            <p>本站尽量只展示与魔方活动直接相关、对查询有必要的信息；不确定或敏感内容以减少公开展示为优先。</p>
          </div>
        </div>
        <div className="grid two">
          {policySections.map((section) => (
            <article className="info-block" key={section.title}>
              <h2>{section.title}</h2>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
