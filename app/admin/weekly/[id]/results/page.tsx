import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { listWeeklyMeetEventConfigs, listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { listWeeklyEligiblePlayers } from "@/lib/weekly-player-library";
import { WCA_EVENTS } from "@/lib/wca-events";
import { WeeklyResultEntryConsole } from "@/app/weekly/admin/weekly-result-entry-console";

export const dynamic = "force-dynamic";

export default async function WeeklyResultsAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meet = (await listWeeklyMeetOptions()).find((item) => item.id === id);
  if (!meet) notFound();
  const [configs, library] = await Promise.all([listWeeklyMeetEventConfigs(id), listWeeklyEligiblePlayers()]);
  const players = library.map((player) => ({ id: player.id, name: player.name, slug: "", wcaId: player.wcaId || "", wcaIdConfirmed: Boolean(player.wcaIdConfirmed), gender: player.gender === "女" ? "女" as const : "男" as const, province: player.province, city: player.city, birthDate: player.birthDate, ageGroup: player.ageGroup || "", ageGroupIsFuzzy: Boolean(player.ageGroupIsFuzzy) }));
  return <><PageHero label="后台管理 / 周赛成绩" title={meet.title}>只允许关联 active 的 player_id；修改和删除都会写入修订记录。</PageHero><section className="container weekly-admin-toolbar"><Link className="button" href={`/admin/weekly/${encodeURIComponent(id)}`}>返回周赛配置</Link><Link className="button primary" href={`/admin/weekly/${encodeURIComponent(id)}/results/import`}>导入标准 Excel</Link></section><WeeklyResultEntryConsole initialMeets={[meet]} initialPlayers={players} events={WCA_EVENTS} initialEventConfigs={configs} mode="admin" initialAdminUnlocked /></>;
}
