import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { listWeeklyLongCardProfilesForAdmin, listWeeklyPlayersForAdmin } from "@/lib/weekly-player-admin-store";
import { WeeklyPlayersAdminConsole } from "../weekly-players-admin-console";

export const dynamic = "force-dynamic";

export default async function AdminWeeklyPlayersPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const [initial, longCardProfiles] = await Promise.all([listWeeklyPlayersForAdmin(), listWeeklyLongCardProfilesForAdmin()]);
  const { new: createNew } = await searchParams;
  return (
    <>
      <PageHero label="后台管理 / 周赛" title="周赛选手档案">
        长期卡学员资料按原始登记顺序保留；电话、精确生日、备注和停用原因只在管理员后台显示。
      </PageHero>
      <section className="container weekly-admin-toolbar" aria-label="周赛选手操作">
        <Link className="button primary" href="/admin/weekly/players?new=1">新建选手</Link>
        <Link className="button" href="/admin/weekly">返回周赛管理</Link>
      </section>
      <WeeklyPlayersAdminConsole initial={initial} longCardProfiles={longCardProfiles} openCreateInitially={createNew === "1"} />
    </>
  );
}
