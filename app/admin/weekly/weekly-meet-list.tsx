"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import type { WeeklyHistoryAdminRow } from "@/lib/weekly-entry-store";
import { useState } from "react";

export function WeeklyMeetList({ initialMeets }: { initialMeets: WeeklyHistoryAdminRow[] }) {
  const [meets, setMeets] = useState(initialMeets);
  const [notice, setNotice] = useState("");
  const [deletingId, setDeletingId] = useState("");

  async function remove(meet: WeeklyHistoryAdminRow) {
    if (!window.confirm(`确认删除“${meet.title}”吗？\n\n只有尚未录入成绩的周赛可以删除，此操作不可恢复。`)) return;
    setDeletingId(meet.id); setNotice("");
    try {
      const response = await fetch(`/api/admin/weekly-competitions/${encodeURIComponent(meet.id)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "删除失败");
      setMeets((current) => current.filter((item) => item.id !== meet.id));
      setNotice(`已删除：${meet.title}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "删除失败"); } finally { setDeletingId(""); }
  }

  return <div className="admin-card">
    <div className="admin-card-heading"><div><h2>周赛列表（{meets.length} 周）</h2><p>可编辑任何周赛；删除会二次确认，且仅允许删除尚未录入成绩的周赛。</p></div></div>
    {notice ? <p className="admin-inline-notice">{notice}</p> : null}
    <div className="table-scroll weekly-admin-table-scroll"><table className="result-table weekly-admin-desktop-table"><thead><tr><th>周次</th><th>周期</th><th>状态</th><th>成绩条数</th><th>参赛选手</th><th>操作</th></tr></thead><tbody>{meets.map((meet) => <tr key={meet.id}><td><Link href={`/admin/weekly/${meet.id}/results`}>{meet.title}</Link></td><td>{meet.dateLabel}</td><td>{meet.status}</td><td>{meet.resultCount}</td><td>{meet.competitorCount}</td><td><span className="weekly-admin-actions"><Link className="button compact" href={`/admin/weekly/${meet.id}`}><Pencil size={14} />编辑</Link><button className="button compact danger" type="button" disabled={Boolean(deletingId)} onClick={() => remove(meet)}><Trash2 size={14} />{deletingId === meet.id ? "删除中" : "删除"}</button></span></td></tr>)}</tbody></table></div>
  </div>;
}
