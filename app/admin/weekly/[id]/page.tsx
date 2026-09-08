import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { listWeeklyMeetEventConfigs, listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { WCA_EVENTS } from "@/lib/wca-events";
import { WeeklyMeetConfigConsole } from "../weekly-meet-config-console";

export const dynamic = "force-dynamic";

export default async function WeeklyMeetAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meets = await listWeeklyMeetOptions();
  const meet = meets.find((item) => item.id === id);
  if (!meet) notFound();
  const configs = await listWeeklyMeetEventConfigs(id);
  return <><PageHero label="后台管理 / 周赛" title={meet.title}>状态：{meet.status}；公开：{meet.isPublic ? "是" : "否"}；数据版本：{meet.dataVersion}</PageHero><section className="container weekly-admin-toolbar"><Link className="button primary" href={`/admin/weekly/${encodeURIComponent(id)}/results`}>管理成绩</Link><Link className="button" href="/admin/weekly">返回周赛管理</Link></section><section className="container section weekly-admin-workspace"><WeeklyMeetConfigConsole initialMeets={[meet]} events={WCA_EVENTS} /></section><section className="container section"><p>已配置项目：{configs.filter((item) => item.enabled).map((item) => `${item.eventId} · ${item.format}`).join("、") || "无"}</p></section></>;
}
