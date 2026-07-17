import { PageHero } from "@/components/page-hero";
import { listWeeklyMeetEventConfigs, listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { getWeeklyAgeGroup } from "@/lib/weekly-age-groups";
import { getMofang602SeedWeeklyPlayers, listWeeklyEligiblePlayers } from "@/lib/weekly-player-library";
import { WCA_EVENTS, WEEKLY_DEFAULT_EVENTS } from "@/lib/wca-events";
import { WeeklyResultEntryConsole } from "../admin/weekly-result-entry-console";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function WeeklyResultsEntryPage() {
  if (!isWeeklyCompetitionEnabled()) notFound();
  const meets = (await listWeeklyMeetOptions().catch(() => [])).filter((meet) => meet.status === "open");
  const currentMeet = meets.find((meet) => meet.status === "open") || meets.find((meet) => meet.id !== "weekly-test-entry");
  const eventConfigs = currentMeet ? await listWeeklyMeetEventConfigs(currentMeet.id).catch(() => []) : [];
  const eventConfigIds = new Set(eventConfigs.filter((config) => config.enabled).map((config) => config.eventId));
  const events = eventConfigIds.size > 0 ? WCA_EVENTS.filter((event) => eventConfigIds.has(event.id)) : WEEKLY_DEFAULT_EVENTS;
  const players = await listWeeklyEligiblePlayers()
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
        title="管理员录入"
      >
        周赛暂不开放选手自行录入；管理员可录入、修正和删除本周成绩。
      </PageHero>
      <WeeklyResultEntryConsole initialMeets={meets} initialPlayers={players} events={events} initialEventConfigs={eventConfigs} mode="admin" />
    </>
  );
}
