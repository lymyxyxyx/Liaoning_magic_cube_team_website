import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { RankingFeedbackConsole } from "./ranking-feedback-console";

export default function AdminRankingFeedbackPage() {
  return (
    <>
      <PageHero
        label="后台管理"
        title="辽宁排名说明与反馈"
        actions={
          <Link className="button" href="/admin">
            返回后台首页
          </Link>
        }
      >
        维护辽宁排名认定口径，并处理名单、成绩和页面反馈。
      </PageHero>
      <RankingFeedbackConsole />
    </>
  );
}
