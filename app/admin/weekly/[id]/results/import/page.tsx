import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { listWeeklyMeetEventConfigs, listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { WeeklyResultsImportConsole } from "@/app/admin/weekly/weekly-results-import-console";

export const dynamic = "force-dynamic";

export default async function WeeklyResultsImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meet = (await listWeeklyMeetOptions()).find((item) => item.id === id);
  if (!meet) notFound();
  const events = await listWeeklyMeetEventConfigs(id);
  return <><PageHero label="后台管理 / 周赛成绩导入" title={meet.title}>标准 Excel 和批量粘贴都会先归一化、校验并保存预览。本轮不会写入正式成绩。</PageHero><section className="container weekly-admin-toolbar"><Link className="button" href={`/admin/weekly/${encodeURIComponent(id)}/results`}>返回成绩管理</Link></section><WeeklyResultsImportConsole meetId={id} templateUrl={`/api/admin/weekly-meets/${encodeURIComponent(id)}/results-template`} events={events} /></>;
}
