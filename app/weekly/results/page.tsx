import { PageHero } from "@/components/page-hero";
import Link from "next/link";
import { listWeeklyMeetEventConfigs, listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { getWeeklyAgeGroup } from "@/lib/weekly-age-groups";
import { listWeeklyEligiblePlayers } from "@/lib/weekly-player-library";
import { WCA_EVENTS, WEEKLY_DEFAULT_EVENTS } from "@/lib/wca-events";
import { WeeklyResultEntryConsole } from "../admin/weekly-result-entry-console";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import { isWeeklyMeetCurrent } from "@/lib/weekly-feature";

export const dynamic = "force-dynamic";

function meetStartsAtTimestamp(value: string | null | undefined) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export default async function WeeklyResultsEntryPage() {
  if (!isWeeklyCompetitionEnabled()) notFound();
  const sessionToken = (await cookies()).get("liaoning_weekly_admin_session")?.value || "";
  const initialAdminUnlocked = sessionToken ? await verifySessionToken(sessionToken, "weekly-admin") : false;
  const allMeets = await listWeeklyMeetOptions();
  const meets = allMeets.filter((meet) => meet.status === "open" && meet.isPublic);
  // Private weekly history is only listed after the server has verified the
  // weekly-admin session. Public visitors continue to see public meets only.
  const historyMeets = allMeets
    .filter((meet) => meet.id !== "weekly-test-entry" && meet.dataVersion === 2 && (meet.isPublic || initialAdminUnlocked))
    .sort((a, b) => meetStartsAtTimestamp(b.startsAt) - meetStartsAtTimestamp(a.startsAt));
  const currentMeet = meets
    .filter(isWeeklyMeetCurrent)
    .sort((a, b) => meetStartsAtTimestamp(b.startsAt) - meetStartsAtTimestamp(a.startsAt))[0]
    || meets
      .filter((meet) => meet.id !== "weekly-test-entry" && (!meet.startsAt || new Date(meet.startsAt).getTime() <= Date.now()))
      .sort((a, b) => meetStartsAtTimestamp(b.startsAt) - meetStartsAtTimestamp(a.startsAt))[0];
  const eventConfigs = currentMeet ? await listWeeklyMeetEventConfigs(currentMeet.id) : [];
  const eventConfigIds = new Set(eventConfigs.filter((config) => config.enabled).map((config) => config.eventId));
  const events = currentMeet ? WCA_EVENTS.filter((event) => eventConfigIds.has(event.id)) : WEEKLY_DEFAULT_EVENTS;
  // Do not serialize the complete player library into the public page. The
  // admin console loads candidates through the authenticated search endpoint
  // after the operator logs in.
  const players = initialAdminUnlocked
    ? await listWeeklyEligiblePlayers()
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
        actions={
          historyMeets.length > 0 ? (
            <nav className="weekly-history-links" aria-label="历史周赛">
              <span>历史周赛</span>
              {historyMeets.map((meet) => (
                <Link href={`/weekly/${meet.slug}`} key={meet.id}>
                  {meet.slug.replace(/^(.+)-week-(\d+)$/, "$1 W$2")}
                </Link>
              ))}
            </nav>
          ) : null
        }
      >
        管理员登录后可录入、修正和删除本周成绩。
      </PageHero>
      <WeeklyResultEntryConsole initialMeets={meets} initialPlayers={players} events={events} initialEventConfigs={eventConfigs} mode="admin" initialAdminUnlocked={initialAdminUnlocked} />
    </>
  );
}
