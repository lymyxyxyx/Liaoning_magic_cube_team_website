import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { listWeeklyHistoryForAdmin } from "@/lib/weekly-entry-store";

export const dynamic = "force-dynamic";

export default async function AdminWeeklyPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  if (view !== "management") redirect("/admin/weekly/players");
  const history = await listWeeklyHistoryForAdmin();
  return <>
    <PageHero label="后台管理" title="周赛管理">已录入的历史周赛数据。</PageHero>
    <WeeklyAdminToolbar active="management" />
    <section className="container section weekly-admin-workspace">
      <div className="admin-card">
        <div className="admin-card-heading"><div><h2>已录入周赛数据（{history.length} 周）</h2><p>2026 年第 27–34 周历史成绩，点击周次可查看该周成绩。</p></div></div>
        <div className="table-scroll weekly-admin-table-scroll"><table className="result-table weekly-admin-desktop-table"><thead><tr><th>周次</th><th>周期</th><th>状态</th><th>成绩条数</th><th>参赛选手</th></tr></thead><tbody>{history.map((meet) => <tr key={meet.id}><td><Link href={`/admin/weekly/${meet.id}/results`}>{meet.title}</Link></td><td>{meet.dateLabel}</td><td>{meet.status}</td><td>{meet.resultCount}</td><td>{meet.competitorCount}</td></tr>)}</tbody></table></div>
      </div>
    </section>
  </>;
}

export function WeeklyAdminToolbar({ active }: { active: "players" | "management" }) {
  return <section className="container weekly-admin-toolbar" aria-label="周赛管理工具">
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
    <a className={`button${active === "players" ? " primary" : ""}`} href="/admin/weekly/players">周赛选手管理</a>
    <Link className={`button${active === "management" ? " primary" : ""}`} href="/admin/weekly?view=management">周赛管理</Link>
    <form action="/api/weekly-auth/logout" method="post"><button className="button" type="submit">退出登录</button></form>
  </section>;
}
