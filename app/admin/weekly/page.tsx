import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { listWeeklyHistoryForAdmin, listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { WCA_EVENTS } from "@/lib/wca-events";
import { WeeklyMeetConfigConsole } from "./weekly-meet-config-console";
import { WeeklyMeetList } from "./weekly-meet-list";

export const dynamic = "force-dynamic";

export default async function AdminWeeklyPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  if (view !== "management") redirect("/admin/weekly/players");
  const [history, meets] = await Promise.all([listWeeklyHistoryForAdmin(), listWeeklyMeetOptions()]);
  return <>
    <PageHero label="后台管理" title="周赛管理">已录入的历史周赛数据。</PageHero>
    <WeeklyAdminToolbar active="management" />
    <section className="container section weekly-admin-workspace">
      <WeeklyMeetConfigConsole initialMeets={meets.filter((meet) => meet.id !== "weekly-test-entry" && meet.dataVersion === 2)} events={WCA_EVENTS} />
      <WeeklyMeetList initialMeets={history} />
    </section>
  </>;
}

export function WeeklyAdminToolbar({ active }: { active: "players" | "management" }) {
  return <section className="container weekly-admin-toolbar" aria-label="周赛管理工具">
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
    <a className={`button${active === "players" ? " primary" : ""}`} href="/admin/weekly/players">周赛选手管理</a>
    <Link className={`button${active === "management" ? " primary" : ""}`} href="/admin/weekly?view=management">周赛管理</Link>
    <Link className="button" href="/weekly">返回本周周赛</Link>
    <form action="/api/weekly-auth/logout" method="post"><button className="button" type="submit">退出登录</button></form>
  </section>;
}
