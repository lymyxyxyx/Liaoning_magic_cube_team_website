import { PageHero } from "@/components/page-hero";
import { listWeeklyLongCardProfilesForAdmin } from "@/lib/weekly-player-admin-store";
import { listWeeklyPlayerLibrary } from "@/lib/weekly-player-library";
import { WeeklyPlayersAdminWorkspace } from "../weekly-players-admin-console";
import { WeeklyAdminToolbar } from "../page";

export const dynamic = "force-dynamic";

export default async function AdminWeeklyPlayersPage() {
  const [longCardProfiles, libraryPlayers] = await Promise.all([
    listWeeklyLongCardProfilesForAdmin(),
    listWeeklyPlayerLibrary()
  ]);
  return (
    <>
      <PageHero label="后台管理 / 周赛" title="周赛选手档案">
        在周赛选手库维护省份、城市和参赛资料；长期卡隐私信息只在管理员后台显示。
      </PageHero>
      <WeeklyAdminToolbar active="players" />
      <WeeklyPlayersAdminWorkspace longCardProfiles={longCardProfiles} libraryPlayers={libraryPlayers} />
    </>
  );
}
