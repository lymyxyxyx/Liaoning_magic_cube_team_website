import { PageHero } from "@/components/page-hero";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { listWeeklyPlayerLibrary } from "@/lib/weekly-player-library";
import { WCA_EVENTS } from "@/lib/wca-events";
import { WeeklyAdminConsole } from "./weekly-admin-console";
import { WeeklyPlayerLibraryConsole } from "./weekly-player-library-console";
import { WeeklyResultEntryConsole } from "./weekly-result-entry-console";

export const dynamic = "force-dynamic";

export default async function WeeklyAdminPage() {
  const meets = await listWeeklyMeetOptions().catch(() => []);
  const libraryPlayers = await listWeeklyPlayerLibrary().catch(() => []);

  return (
    <>
      <PageHero label="周赛录入" title="周赛成绩后台">
        从 Excel 复制成绩表，粘贴后自动生成排名、预览表格，并保存到网站周赛页面。
      </PageHero>
      <WeeklyResultEntryConsole initialMeets={meets} events={WCA_EVENTS} />
      <WeeklyPlayerLibraryConsole initialPlayers={libraryPlayers} />
      <WeeklyAdminConsole />
    </>
  );
}
