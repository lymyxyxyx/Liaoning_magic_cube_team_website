import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { RankingFeedbackConsole } from "./ranking-feedback-console";

export default function AdminRankingFeedbackPage() {
  return (
    <>
      <PageHero
        label="后台管理"
        title="信息反馈接收"
        actions={
          <Link className="button" href="/admin">
            返回后台首页
          </Link>
        }
      >
        处理关于本站提交的信息更正、隐藏删除、补充资料和页面问题。
      </PageHero>
      <RankingFeedbackConsole />
    </>
  );
}
