import { PageHero } from "@/components/page-hero";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { getMofang602SeedWeeklyPlayers, listWeeklyPlayerLibrary } from "@/lib/weekly-player-library";
import { WCA_EVENTS } from "@/lib/wca-events";
import { WeeklyAdminConsole } from "./weekly-admin-console";
import { WeeklyPlayerLibraryConsole } from "./weekly-player-library-console";
import { WeeklyResultEntryConsole } from "./weekly-result-entry-console";

export const dynamic = "force-dynamic";

export default async function WeeklyAdminPage() {
  const meets = await listWeeklyMeetOptions().catch(() => []);
  const libraryPlayers = await listWeeklyPlayerLibrary()
    .then((players) => (players.length > 0 ? players : getMofang602SeedWeeklyPlayers()))
    .catch(() => getMofang602SeedWeeklyPlayers());

  return (
    <>
      <PageHero label="周赛录入" title="周赛成绩后台">
        默认进入单人成绩录入；旧版周赛信息和粘贴成绩表暂时折叠保留。
      </PageHero>
      <section className="container section weekly-admin-workspace">
        <WeeklyPlayerLibraryConsole initialPlayers={libraryPlayers} variant="side" />
        <WeeklyResultEntryConsole initialMeets={meets} events={WCA_EVENTS} variant="workspace" />
      </section>
      <WeeklyAdminConsole />
    </>
  );
}
