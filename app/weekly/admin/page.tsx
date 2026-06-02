import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { WCA_EVENTS } from "@/lib/wca-events";
import { WeeklyResultEntryConsole } from "./weekly-result-entry-console";

export const dynamic = "force-dynamic";

export default async function WeeklyAdminPage() {
  const meets = await listWeeklyMeetOptions().catch(() => []);

  return (
    <>
      <PageHero label="周赛录入" title="周赛成绩后台">
        选择周赛、项目和选手后录入成绩；选手资料请进入独立选手库维护。
      </PageHero>
      <section className="container weekly-admin-toolbar" aria-label="周赛后台工具">
        <Link className="button" href="/weekly/admin/player-library">
          周赛选手库
        </Link>
        <Link className="button" href="/weekly">
          查看周赛页
        </Link>
      </section>
      <section className="container section weekly-admin-workspace">
        <WeeklyResultEntryConsole initialMeets={meets} events={WCA_EVENTS} variant="workspace" />
      </section>
    </>
  );
}
