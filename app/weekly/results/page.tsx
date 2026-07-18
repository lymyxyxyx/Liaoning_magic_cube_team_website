import { PageHero } from "@/components/page-hero";
import Link from "next/link";
import { listWeeklyMeetEventConfigs, listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { getWeeklyAgeGroup } from "@/lib/weekly-age-groups";
import { getMofang602SeedWeeklyPlayers, listWeeklyEligiblePlayers } from "@/lib/weekly-player-library";
import { WCA_EVENTS, WEEKLY_DEFAULT_EVENTS } from "@/lib/wca-events";
import { WeeklyResultEntryConsole } from "../admin/weekly-result-entry-console";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import { isWeeklyMeetCurrent } from "@/lib/weekly-feature";

export const dynamic = "force-dynamic";

export default async function WeeklyResultsEntryPage() {
  if (!isWeeklyCompetitionEnabled()) notFound();
  const sessionToken = (await cookies()).get("liaoning_weekly_session")?.value || "";
  const initialAdminUnlocked = sessionToken ? await verifySessionToken(sessionToken) : false;
  const meets = (await listWeeklyMeetOptions().catch(() => [])).filter((meet) => meet.status === "open");
  const currentMeet = meets
    .filter(isWeeklyMeetCurrent)
    .sort((a, b) => (b.startsAt || "").localeCompare(a.startsAt || ""))[0]
    || meets
      .filter((meet) => meet.id !== "weekly-test-entry" && (!meet.startsAt || new Date(meet.startsAt).getTime() <= Date.now()))
      .sort((a, b) => (b.startsAt || "").localeCompare(a.startsAt || ""))[0];
  const eventConfigs = currentMeet ? await listWeeklyMeetEventConfigs(currentMeet.id).catch(() => []) : [];
  const eventConfigIds = new Set(eventConfigs.filter((config) => config.enabled).map((config) => config.eventId));
  const events = eventConfigIds.size > 0 ? WCA_EVENTS.filter((event) => eventConfigIds.has(event.id)) : WEEKLY_DEFAULT_EVENTS;
  // Do not serialize the complete player library into the public page. The
  // admin console loads candidates through the authenticated search endpoint
  // after the operator logs in.
  const players = initialAdminUnlocked
    ? await listWeeklyEligiblePlayers()
        .catch(() => getMofang602SeedWeeklyPlayers())
        .then((libraryPlayers) =>
          libraryPlayers.map((player) => ({
            id: player.id,
            name: player.name,
            slug: "",
            wcaId: player.wcaId || "",
            wcaIdConfirmed: Boolean(player.wcaIdConfirmed),
            gender: player.gender === "女" ? ("女" as const) : ("男" as const),
            province: player.province,
            city: player.city,
            birthDate: player.birthDate,
            ageGroup: getWeeklyAgeGroup(player.birthDate) || player.ageGroup || "",
            ageGroupIsFuzzy: Boolean(player.ageGroupIsFuzzy)
          }))
        )
    : [];

  return (
    <>
      <PageHero
        className="page-hero--compact weekly-results-page-hero"
        label="周赛成绩"
        title="周赛成绩"
        actions={<Link className="button" href="/weekly/history">历史周赛</Link>}
      >
        管理员登录后可录入、修正和删除本周成绩。
      </PageHero>
      <WeeklyResultEntryConsole initialMeets={meets} initialPlayers={players} events={events} initialEventConfigs={eventConfigs} mode="admin" initialAdminUnlocked={initialAdminUnlocked} />
    </>
  );
}
