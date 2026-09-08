import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { WCA_EVENTS } from "@/lib/wca-events";
import { WeeklyMeetConfigConsole } from "./weekly-meet-config-console";
import { BigStackAdminConsole } from "./big-stack-console";
import { listBigStackRecords } from "@/lib/big-stack";

export const dynamic = "force-dynamic";

export default async function AdminWeeklyPage() {
  const meets = await listWeeklyMeetOptions();
  const bigStackRecords = await listBigStackRecords().catch(() => []);

  return (
    <>
      <PageHero label="后台管理" title="周赛管理">
        管理周赛项目、选手库和历史数据；日常成绩录入请使用前台“立即参加”入口。
      </PageHero>
      <section className="container weekly-admin-toolbar" aria-label="周赛管理工具">
        <Link className="button primary" href="/admin/weekly/players">
          周赛选手库
        </Link>
        <Link className="button" href="/admin/weekly/players/import">
          导入选手 Excel
        </Link>
        <Link className="button" href="/weekly/results">
          前台录入入口
        </Link>
        <Link className="button" href="/weekly">
          查看周赛页
        </Link>
        <Link className="button" href="/weekly/big-stack">
          查看大堆成绩
        </Link>
        <Link className="button" href="/admin/weekly#big-stack-admin">
          管理大堆成绩
        </Link>
        <form action="/api/weekly-auth/logout" method="post">
          <button className="button" type="submit">退出周赛后台</button>
        </form>
      </section>
      <section className="container section weekly-admin-workspace">
        <WeeklyMeetConfigConsole initialMeets={meets} events={WCA_EVENTS} />
      </section>
      <BigStackAdminConsole initialRecords={bigStackRecords} />
    </>
  );
}
