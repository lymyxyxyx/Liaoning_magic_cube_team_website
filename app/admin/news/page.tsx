import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { NewsAdminConsole } from "./news-admin-console";

export default function AdminNewsPage() {
  return (
    <>
      <PageHero
        label="后台管理"
        title="新闻动态"
        actions={
          <Link className="button" href="/admin">
            返回后台首页
          </Link>
        }
      >
        发布与维护首页和新闻页展示的赛事、成绩、公告与活动动态。
      </PageHero>
      <NewsAdminConsole />
    </>
  );
}
