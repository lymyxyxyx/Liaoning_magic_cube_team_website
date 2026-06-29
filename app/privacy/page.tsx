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
      "本站展示的 WCA 成绩、赛事、排名等信息主要来自 WCA 官方公开数据及公开赛事页面。",
      "辽宁本地选手档案、周赛记录、裁判员名单、商业战队成员等信息，可能来自公开赛事资料、现场活动记录、相关组织或管理员后台录入。",
      "用户通过反馈、纠错、补充资料等方式提交的信息，仅用于核对和维护本站资料。"
    ]
  },
  {
    title: "展示范围",
    items: [
      "公开页面优先展示与魔方活动直接相关的信息，例如姓名、WCA ID、地区、成绩、赛事记录、荣誉经历和公开身份。",
      "本站不主动公开身份证号、手机号、微信号、详细住址、后台口令等敏感信息。",
      "涉及未成年人时，本站会尽量控制展示范围；如监护人或本人认为某项信息不宜展示，可联系管理员处理。"
    ]
  },
  {
    title: "反馈、更正与删除",
    items: [
      "如果页面中的姓名、城市、身份、成绩归属或其他资料存在错误，可以通过本站反馈入口或管理员联系方式申请更正。",
      "如果本人、监护人或相关组织希望隐藏、删除或调整非必要展示信息，管理员会在核对身份和事实后处理。",
      "公开赛事成绩通常来自第三方公开数据源；本站可调整本站展示方式，但无法直接修改第三方平台原始数据。"
    ]
  },
  {
    title: "访问统计",
    items: [
      "目前本站不在前台接入第三方广告或跨站追踪脚本。",
      "如启用本站自有访问统计，将仅用于了解页面访问量、访问路径和基础设备类型，帮助维护网站稳定性与内容质量。",
      "统计可能使用访问时间、页面路径、来源页面、浏览器 User-Agent、IP 地址的哈希或粗略地域信息；不会公开单个访问者的访问记录。"
    ]
  },
  {
    title: "后台录入与权限",
    items: [
      "后台录入的信息仅供管理员维护网站内容，不作为官方身份认证或赛事认证依据。",
      "后台访问通过口令和会话 Cookie 控制，管理员应妥善保管口令，避免在公共设备上保持登录。",
      "如果发现后台数据误录、重复或过期，应以公开赛事资料、本人反馈或相关组织确认为准进行修正。"
    ]
  },
  {
    title: "说明更新",
    items: [
      "本站功能和数据范围调整时，本说明可能同步更新。",
      "最近更新日期：2026 年 6 月 29 日。"
    ]
  }
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero label="隐私说明" title="本站如何使用和展示资料">
        辽宁地区魔方信息查询网用于查询公开赛事、排名、周赛与本地魔方活动资料。本页说明本站的数据来源、展示范围和更正删除方式。
      </PageHero>
      <section className="container section">
        <div className="section-header">
          <div>
            <span className="eyebrow">Privacy</span>
            <h2>资料处理原则</h2>
            <p>本站尽量只展示与魔方活动直接相关、对查询有必要的信息；遇到不确定或敏感内容时，以减少公开展示为优先。</p>
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
