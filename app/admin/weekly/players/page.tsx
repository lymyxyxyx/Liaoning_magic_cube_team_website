import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { listWeeklyLongCardProfilesForAdmin, listWeeklyPlayersForAdmin } from "@/lib/weekly-player-admin-store";
import { WeeklyPlayersAdminConsole } from "../weekly-players-admin-console";

export const dynamic = "force-dynamic";

export default async function AdminWeeklyPlayersPage() {
  const [initial, longCardProfiles] = await Promise.all([listWeeklyPlayersForAdmin(), listWeeklyLongCardProfilesForAdmin()]);
  return (
    <>
      <PageHero label="后台管理 / 周赛" title="周赛选手档案">
        选手 ID 稳定、与姓名无关。精确生日、备注和停用原因只在管理员后台显示。
      </PageHero>
      <section className="container weekly-admin-toolbar" aria-label="周赛选手操作">
        <Link className="button primary" href="/admin/weekly/players/import">导入选手 Excel</Link>
        <Link className="button" href="/admin/weekly">返回周赛管理</Link>
      </section>
      <WeeklyPlayersAdminConsole initial={initial} longCardProfiles={longCardProfiles} />
    </>
  );
}
