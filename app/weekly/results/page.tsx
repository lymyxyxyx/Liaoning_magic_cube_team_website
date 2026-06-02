import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { WCA_EVENTS } from "@/lib/wca-events";
import { WeeklyResultEntryConsole } from "../admin/weekly-result-entry-console";

export const dynamic = "force-dynamic";

export default async function WeeklyResultsEntryPage() {
  const meets = await listWeeklyMeetOptions().catch(() => []);

  return (
    <>
      <PageHero
        className="page-hero--compact"
        actions={
          <Link className="button" href="/weekly">
            <ArrowLeft size={16} />
            返回周赛
          </Link>
        }
        label="周赛成绩"
        title="周赛成绩录入"
      >
        选择周赛与项目，输入选手和五次成绩。
      </PageHero>
      <WeeklyResultEntryConsole initialMeets={meets} events={WCA_EVENTS} />
    </>
  );
}
