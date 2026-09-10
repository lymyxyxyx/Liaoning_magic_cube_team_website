import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { listWeeklyLongCardProfilesForAdmin } from "@/lib/weekly-player-admin-store";
import { WeeklyPlayersAdminConsole } from "../weekly-players-admin-console";

export const dynamic = "force-dynamic";

export default async function AdminWeeklyPlayersPage() {
  const longCardProfiles = await listWeeklyLongCardProfilesForAdmin();
  return (
    <>
      <PageHero label="后台管理 / 周赛" title="周赛选手档案">
        长期卡学员资料按登记顺序保留；电话、精确生日和备注只在管理员后台显示。
      </PageHero>
      <section className="container weekly-admin-toolbar" aria-label="周赛选手操作">
        <Link className="button" href="/admin/weekly">返回周赛管理</Link>
      </section>
      <WeeklyPlayersAdminConsole longCardProfiles={longCardProfiles} />
    </>
  );
}
