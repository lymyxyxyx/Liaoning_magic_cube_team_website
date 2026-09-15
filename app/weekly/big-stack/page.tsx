import Link from "next/link";
import { cookies } from "next/headers";
import { PageHero } from "@/components/page-hero";
import { BIG_STACK_EVENTS, isBigStackEvent, listBigStackRecords } from "@/lib/big-stack";
import { hasWeeklyAdminCookie } from "@/lib/weekly-admin-auth";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";
import { notFound } from "next/navigation";
import { BigStackConsole } from "./big-stack-console";

export const dynamic = "force-dynamic";

export default async function BigStackPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  if (!isWeeklyCompetitionEnabled()) notFound();
  const params = await searchParams;
  const eventId = isBigStackEvent(params.event || "") ? params.event as typeof BIG_STACK_EVENTS[number]["id"] : "333";
  const [records, allMeets, isAdmin] = await Promise.all([
    listBigStackRecords(eventId),
    listWeeklyMeetOptions(),
    hasWeeklyAdminCookie(await cookies())
  ]);
  const meets = allMeets.filter((meet) => meet.dataVersion === 2 && meet.id !== "weekly-test-entry").map((meet) => ({ id: meet.id, title: meet.title }));
  const selectedEvent = BIG_STACK_EVENTS.find((event) => event.id === eventId)!;
  return <>
    <PageHero className="page-hero--compact weekly-results-page-hero" label="辽宁线上周赛" title="大堆总榜" actions={<Link className="button" href="/weekly">返回周赛</Link>}>
      一小时内还原魔方数量排名。每个项目独立排名，个人可保留多期参赛记录；总榜按该项目的最高数量排序。
    </PageHero>
    <section className="container section big-stack-page-intro"><nav className="weekly-provincial-ranking-tabs" aria-label="大堆项目">
      {BIG_STACK_EVENTS.map((event) => <Link className={event.id === eventId ? "is-active" : ""} href={`/weekly/big-stack?event=${event.id}`} key={event.id}>{event.name}</Link>)}
    </nav><p className="weekly-provincial-ranking-note"><strong>{selectedEvent.name}大堆榜</strong><span>计量单位：一小时内还原数量；同数量并列。历史记录尚未确认周次时会明确标注“期次待补”。</span></p></section>
    <BigStackConsole eventId={eventId} records={records} meets={meets} isAdmin={isAdmin} />
  </>;
}
