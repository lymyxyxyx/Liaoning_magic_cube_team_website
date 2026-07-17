import { PageHero } from "@/components/page-hero";
import { listWeeklyMeetEventConfigs, listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { getWeeklyAgeGroup } from "@/lib/weekly-age-groups";
import { getMofang602SeedWeeklyPlayers, listWeeklyEligiblePlayers } from "@/lib/weekly-player-library";
import { WCA_EVENTS, WEEKLY_DEFAULT_EVENTS } from "@/lib/wca-events";
import { WeeklyResultEntryConsole } from "../admin/weekly-result-entry-console";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import { listBigStackRecords, getRankedBigStackRecords } from "@/lib/big-stack";
import { BigStackCarousel } from "../big-stack/big-stack-carousel";

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

  const sessionToken = (await cookies()).get("liaoning_weekly_session")?.value || "";
  const initialAdminUnlocked = sessionToken ? await verifySessionToken(sessionToken) : false;
  const bigStackRecords = getRankedBigStackRecords(await listBigStackRecords().catch(() => []));

  return (
    <>
      <PageHero
        className="page-hero--compact weekly-results-page-hero"
        label="周赛成绩"
        title="周赛成绩"
      >
        管理员登录后可录入、修正和删除本周成绩。
      </PageHero>
      <WeeklyResultEntryConsole initialMeets={meets} initialPlayers={players} events={events} initialEventConfigs={eventConfigs} mode="admin" initialAdminUnlocked={initialAdminUnlocked} />
      <section className="container section weekly-front-big-stack">
        <div className="section-header">
          <div><span className="eyebrow">周赛特别榜单</span><h2>单轮大堆纪录</h2><p>一小时内复原三阶魔方数量，按数量从高到低展示。</p></div>
          <a className="button" href="/weekly/big-stack">查看完整榜单</a>
        </div>
        <BigStackCarousel records={bigStackRecords} />
      </section>
    </>
  );
}
