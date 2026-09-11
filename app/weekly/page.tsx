import { PageHero } from "@/components/page-hero";
import { cookies } from "next/headers";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { isGuestWeeklyHistoryMeet } from "@/lib/weekly-guest-history";
import { hasWeeklyAdminCookie } from "@/lib/weekly-admin-auth";
import { WEEKLY_DEFAULT_EVENTS } from "@/lib/wca-events";
import { WeeklyResultEntryConsole } from "./admin/weekly-result-entry-console";
import { WeeklyHistoryMenu } from "@/components/weekly-history-menu";
import { WeeklyInlineAdminLogin } from "@/components/weekly-inline-admin-login";
import Link from "next/link";
import { WeeklyCurrentResults } from "@/components/weekly-current-results";

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
  const historyMeets = allMeets
    .filter((meet) => isGuestWeeklyHistoryMeet(meet))
    .sort((a, b) => meetStartsAtTimestamp(b.startsAt) - meetStartsAtTimestamp(a.startsAt));
  const adminMeets = allMeets.filter((meet) => meet.id !== "weekly-test-entry" && meet.dataVersion === 2);
  const currentMeet = adminMeets.filter((meet) => meet.status === "open" && (!meet.startsAt || new Date(meet.startsAt).getTime() <= Date.now()) && (!meet.endsAt || new Date(meet.endsAt).getTime() >= Date.now())).sort((left, right) => meetStartsAtTimestamp(right.startsAt) - meetStartsAtTimestamp(left.startsAt))[0];

  return (
    <>
      <PageHero
        className="weekly-current-page-hero"
        actions={
          <div className="weekly-page-actions">
            <WeeklyHistoryMenu meets={historyMeets} />
            <Link className="weekly-grade-standards-link" href="/weekly/grade-standards">等级标准</Link>
            <WeeklyInlineAdminLogin isAdmin={isAdmin} />
            {isAdmin ? <>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a className="weekly-admin-library-link" href="/admin/weekly">后台管理</a>
            </> : null}
          </div>
        }
        label="辽宁线上周赛"
        title="本周周赛成绩"
      >
        本周成绩将在管理员录入后显示；当前游客可直接查看，不需要邀请码。
      </PageHero>

      {currentMeet ? <WeeklyCurrentResults meet={currentMeet} /> : null}

      {isAdmin ? (
        <WeeklyResultEntryConsole
          initialAdminUnlocked
          initialMeets={adminMeets}
          events={WEEKLY_DEFAULT_EVENTS}
          mode="admin"
          variant="full"
        />
      ) : null}
    </>
  );
}
