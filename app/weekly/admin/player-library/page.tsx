import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { getMofang602SeedWeeklyPlayers, listWeeklyPlayerLibrary } from "@/lib/weekly-player-library";
import { WeeklyPlayerLibraryConsole } from "../weekly-player-library-console";

export const dynamic = "force-dynamic";

export default async function WeeklyPlayerLibraryPage() {
  const libraryPlayers = await listWeeklyPlayerLibrary()
    .then((players) => (players.length > 0 ? players : getMofang602SeedWeeklyPlayers()))
    .catch(() => getMofang602SeedWeeklyPlayers());

  return (
    <>
      <PageHero label="周赛后台" title="周赛选手库">
        单独维护周赛选手列表；新增选手、搜索和资料编辑都在这里完成。
      </PageHero>
      <section className="container weekly-admin-toolbar" aria-label="周赛后台工具">
        <Link className="button" href="/weekly/admin">
          返回成绩录入
        </Link>
      </section>
      <WeeklyPlayerLibraryConsole initialPlayers={libraryPlayers} />
    </>
  );
}
