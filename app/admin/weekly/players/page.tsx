import { PageHero } from "@/components/page-hero";
import { listWeeklyLongCardProfilesForAdmin } from "@/lib/weekly-player-admin-store";
import { WeeklyPlayersAdminConsole } from "../weekly-players-admin-console";
import { WeeklyAdminToolbar } from "../page";

export const dynamic = "force-dynamic";

export default async function AdminWeeklyPlayersPage() {
  const longCardProfiles = await listWeeklyLongCardProfilesForAdmin();
  return (
    <>
      <PageHero label="后台管理 / 周赛" title="周赛选手档案">
        长期卡学员资料按登记顺序保留；电话、精确生日和备注只在管理员后台显示。
      </PageHero>
      <WeeklyAdminToolbar active="players" />
      <WeeklyPlayersAdminConsole longCardProfiles={longCardProfiles} />
    </>
  );
}
