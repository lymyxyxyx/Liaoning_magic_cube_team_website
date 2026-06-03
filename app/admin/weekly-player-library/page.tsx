import { PageHero } from "@/components/page-hero";
import Link from "next/link";
import { getMofang602SeedWeeklyPlayers, listWeeklyPlayerLibrary } from "@/lib/weekly-player-library";
import { WeeklyPlayerLibraryConsole } from "@/app/weekly/admin/weekly-player-library-console";

export const dynamic = "force-dynamic";

export default async function AdminWeeklyPlayerLibraryPage() {
  const libraryPlayers = await listWeeklyPlayerLibrary()
    .then((players) => (players.length > 0 ? players : getMofang602SeedWeeklyPlayers()))
    .catch(() => getMofang602SeedWeeklyPlayers());

  return (
    <>
      <PageHero
        label="后台管理"
        title="周赛选手库"
        actions={
          <Link className="button" href="/admin">
            返回后台首页
          </Link>
        }
      >
        维护周赛选手资料。前台只展示组别等公开信息，出生年月日仅在后台编辑使用。
      </PageHero>
      <WeeklyPlayerLibraryConsole initialPlayers={libraryPlayers} apiPath="/api/admin/weekly-player-library" />
    </>
  );
}
