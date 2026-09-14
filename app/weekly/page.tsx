import { PageHero } from "@/components/page-hero";
import { cookies } from "next/headers";
import { listWeeklyMeetEventConfigs, listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { isGuestWeeklyHistoryMeet } from "@/lib/weekly-guest-history";
import { hasWeeklyAdminCookie } from "@/lib/weekly-admin-auth";
import { WEEKLY_DEFAULT_EVENTS } from "@/lib/wca-events";
import { WeeklyResultEntryConsole } from "./admin/weekly-result-entry-console";
import { WeeklyHistoryMenu } from "@/components/weekly-history-menu";
import { WeeklyInlineAdminLogin } from "@/components/weekly-inline-admin-login";
import Link from "next/link";
import { isWeeklyMeetCurrent } from "@/lib/weekly-meet-status";

export const dynamic = "force-dynamic";

function meetStartsAtTimestamp(value: string | null | undefined) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export default async function WeeklyPage() {
  const [allMeets, isAdmin] = await Promise.all([
    listWeeklyMeetOptions().catch(() => []),
    hasWeeklyAdminCookie(await cookies())
  ]);
  const adminMeets = allMeets.filter((meet) => meet.id !== "weekly-test-entry" && meet.dataVersion === 2);
  const historyMeets = (isAdmin ? adminMeets : allMeets.filter((meet) => isGuestWeeklyHistoryMeet(meet)))
    .sort((a, b) => meetStartsAtTimestamp(b.startsAt) - meetStartsAtTimestamp(a.startsAt));
  const visibleMeets = adminMeets;
  const currentMeet = visibleMeets.filter(isWeeklyMeetCurrent).sort((left, right) => meetStartsAtTimestamp(right.startsAt) - meetStartsAtTimestamp(left.startsAt))[0];
  const historyMenuMeets = !isAdmin && currentMeet ? [currentMeet, ...historyMeets] : historyMeets;
  // Guests should always arrive at a leaderboard. Between weekly windows,
  // fall back to the latest completed, publicly visible meet rather than
  // leaving the page with only the history menu.
  const guestDisplayMeet = currentMeet || historyMeets[0];
  const publicDisplayMeet = isAdmin ? currentMeet : guestDisplayMeet;
  const [currentEventConfigs, adminMeetEventConfigEntries] = await Promise.all([
    publicDisplayMeet ? listWeeklyMeetEventConfigs(publicDisplayMeet.id).catch(() => []) : Promise.resolve([]),
    isAdmin ? Promise.all(adminMeets.map(async (meet) => [meet.id, await listWeeklyMeetEventConfigs(meet.id).catch(() => [])] as const)) : Promise.resolve([])
  ]);
  const adminMeetEventConfigsById = Object.fromEntries(adminMeetEventConfigEntries);
  const emptyGuest = !isAdmin && !publicDisplayMeet;

  return (
    <>
      <PageHero
        className="weekly-current-page-hero"
        actions={
          <div className="weekly-page-actions">
            <WeeklyHistoryMenu meets={historyMenuMeets} />
            <Link className="weekly-grade-standards-link" href="/weekly/provincial-rankings">辽宁省榜</Link>
            <Link className="weekly-grade-standards-link" href="/weekly/grade-standards">等级标准</Link>
            <WeeklyInlineAdminLogin isAdmin={isAdmin} />
            {isAdmin ? <>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a className="weekly-admin-library-link" href="/admin/weekly?view=management">周赛管理</a>
            </> : null}
          </div>
        }
        label="辽宁线上周赛"
        title={emptyGuest ? "本周暂无进行中的周赛" : publicDisplayMeet?.title || "本周周赛成绩"}
      >
        {emptyGuest
          ? "周赛开始后，成绩将直接在此展示，游客无需邀请码。可先通过上方菜单查看历史周赛。"
          : currentMeet
            ? "本周成绩将在管理员录入后显示；当前游客可直接查看，不需要邀请码。"
            : "正在展示最近一期周赛成绩；游客可直接查看，不需要邀请码。"}
      </PageHero>

      {isAdmin ? (
        <WeeklyResultEntryConsole
          initialAdminUnlocked
          initialMeets={adminMeets}
          events={WEEKLY_DEFAULT_EVENTS}
          initialMeetEventConfigsById={adminMeetEventConfigsById}
          mode="admin"
          variant="full"
        />
      ) : publicDisplayMeet ? (
        <WeeklyResultEntryConsole
          initialMeets={[publicDisplayMeet]}
          events={WEEKLY_DEFAULT_EVENTS}
          initialEventConfigs={currentEventConfigs}
          initialResultEventIds={currentEventConfigs.filter((config) => config.enabled).map((config) => config.eventId)}
          mode="public"
          initialAdminUnlocked={false}
          resultsOnly
        />
      ) : null}
    </>
  );
}
