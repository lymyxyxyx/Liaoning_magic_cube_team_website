import { PageHero } from "@/components/page-hero";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { getWeeklyAgeGroup } from "@/lib/weekly-age-groups";
import { getMofang602SeedWeeklyPlayers, listWeeklyPlayerLibrary } from "@/lib/weekly-player-library";
import { WCA_EVENTS } from "@/lib/wca-events";
import { WeeklyResultEntryConsole } from "../admin/weekly-result-entry-console";

export const dynamic = "force-dynamic";

export default async function WeeklyResultsEntryPage() {
  const meets = await listWeeklyMeetOptions().catch(() => []);
  const players = await listWeeklyPlayerLibrary()
    .catch(() => getMofang602SeedWeeklyPlayers())
    .then((libraryPlayers) =>
      libraryPlayers.map((player) => ({
        id: player.id,
        name: player.name,
        slug: "",
        wcaId: player.wcaId || "",
        gender: player.gender === "女" ? ("女" as const) : ("男" as const),
        province: player.province,
        city: player.city,
        birthDate: player.birthDate,
        ageGroup: getWeeklyAgeGroup(player.birthDate) || player.ageGroup || "",
        ageGroupIsFuzzy: Boolean(player.ageGroupIsFuzzy)
      }))
    );

  return (
    <>
      <PageHero
        className="page-hero--compact weekly-results-page-hero"
        label="周赛成绩"
        title="立即参加"
      >
        默认录入当前周赛，选择项目和赛制后输入成绩。
      </PageHero>
      <WeeklyResultEntryConsole initialMeets={meets} initialPlayers={players} events={WCA_EVENTS} mode="public" />
    </>
  );
}
