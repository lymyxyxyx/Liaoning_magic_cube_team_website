import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { AdminConsole } from "../admin-console";

export default function AdminLocalPlayerLibraryPage() {
  return (
    <>
      <PageHero
        label="后台管理"
        title="辽宁选手库"
        actions={
          <Link className="button" href="/admin">
            返回后台首页
          </Link>
        }
      >
        维护本地选手 WCA ID、省份、城市和人工核对记录。
      </PageHero>
      <AdminConsole />
    </>
  );
}
