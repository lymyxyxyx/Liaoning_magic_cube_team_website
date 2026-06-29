import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { CommercialSubmissionsConsole } from "./commercial-submissions-console";

export default function AdminCommercialSubmissionsPage() {
  return (
    <>
      <PageHero
        label="后台管理"
        title="成员简介审核"
        actions={
          <Link className="button" href="/admin">
            返回后台首页
          </Link>
        }
      >
        查看选手、家长或老师提交的战队成员简介，审核后再整理到前台展示。
      </PageHero>
      <CommercialSubmissionsConsole />
    </>
  );
}
