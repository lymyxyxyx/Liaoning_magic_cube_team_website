import { PageHero } from "@/components/page-hero";
import { AdminConsole } from "./admin-console";

export default function AdminPage() {
  return (
    <>
      <PageHero label="后台管理" title="辽宁选手库维护">
        维护本地选手 WCA ID、省份、城市和人工核对记录。
      </PageHero>
      <AdminConsole />
    </>
  );
}
