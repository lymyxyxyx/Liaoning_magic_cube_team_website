import { PageHero } from "@/components/page-hero";
import { listPlayerImportBatches } from "@/lib/weekly-player-admin-store";
import { WeeklyPlayerImportConsole } from "../../weekly-player-import-console";

export const dynamic = "force-dynamic";

export default async function AdminWeeklyPlayerImportPage() {
  const initialBatches = await listPlayerImportBatches();
  return (
    <>
      <PageHero label="后台管理 / 周赛" title="导入周赛选手档案">
        仅支持当前长期卡学员 Excel 的固定结构。上传只生成预览，确认后才会写入数据库。
      </PageHero>
      <section className="container weekly-admin-toolbar" aria-label="选手导入导航">
        {/* Force a document navigation so stale admin router state cannot trap this link. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="button" href="/admin/weekly/players">返回选手档案</a>
      </section>
      <WeeklyPlayerImportConsole initialBatches={initialBatches} />
    </>
  );
}
