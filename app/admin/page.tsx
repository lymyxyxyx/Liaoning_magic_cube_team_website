import { PageHero } from "@/components/page-hero";
import Link from "next/link";

const adminCards = [
  {
    title: "新闻动态",
    href: "/admin/news",
    description: "发布与维护首页和新闻页展示的赛事、成绩、公告与活动动态。"
  },
  {
    title: "辽宁选手库",
    href: "/admin/local-player-library",
    description: "维护本地选手 WCA ID、省份、城市和人工核对记录。"
  },
  {
    title: "信息反馈接收",
    href: "/admin/ranking-feedback",
    description: "查看并处理关于本站提交的信息更正、隐藏删除、补充资料和页面问题。"
  },
  {
    title: "周赛选手库",
    href: "/admin/weekly-player-library",
    description: "维护周赛录入使用的选手资料、生日和自动组别。"
  },
  {
    title: "周赛管理",
    href: "/admin/weekly",
    description: "管理周赛设置和历史数据；日常录成绩统一使用前台立即参加入口。"
  },
  {
    title: "成员简介审核",
    href: "/admin/commercial-submissions",
    description: "审核选手、家长或老师提交的战队成员简介补充与更正。"
  },
  {
    title: "比赛账单",
    href: "/admin/accounts",
    description: "管理单场比赛收入、支出、分类小计和结余。"
  }
];

export default function AdminPage() {
  return (
    <>
      <PageHero label="后台管理" title="网站管理后台">
        进入对应模块维护人员资料、信息反馈、周赛选手和比赛账单。
      </PageHero>
      <section className="container section admin-module-grid" aria-label="后台功能入口">
        {adminCards.map((card) => (
          <Link className="admin-module-card" href={card.href} key={card.href}>
            <strong>{card.title}</strong>
            <span>{card.description}</span>
          </Link>
        ))}
      </section>
    </>
  );
}
