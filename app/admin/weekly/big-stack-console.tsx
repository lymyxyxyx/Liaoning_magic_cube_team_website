"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import type { BigStackRecord } from "@/lib/big-stack";

export function BigStackAdminConsole({ initialRecords }: { initialRecords: BigStackRecord[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  function updateRecord(index: number, patch: Partial<BigStackRecord>) {
    setRecords((current) => current.map((record, recordIndex) => (recordIndex === index ? { ...record, ...patch } : record)));
  }

  function addRecord() {
    setRecords((current) => [...current, { name: "", count: 0 }]);
  }

  function removeRecord(index: number) {
    setRecords((current) => current.filter((_, recordIndex) => recordIndex !== index));
  }

  function save() {
    setSaving(true);
    setNotice("");
    fetch("/api/admin/big-stack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records })
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { records?: BigStackRecord[]; message?: string } | null;
        if (!response.ok) throw new Error(payload?.message || "保存失败");
        setRecords(payload?.records || []);
        setNotice("大堆纪录已保存，前台会按数量重新排序。");
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "保存失败"))
      .finally(() => setSaving(false));
  }

  return (
    <section id="big-stack-admin" className="container section admin-card big-stack-admin-console">
      <div className="admin-card-heading">
        <div>
          <h2>大堆纪录维护</h2>
          <p>填写每名学员在一小时内复原三阶魔方的数量，前台自动按数量从高到低排列。</p>
        </div>
        <div className="weekly-entry-heading-actions">
          <button className="button" type="button" onClick={addRecord}><Plus size={16} />新增</button>
          <button className="button primary" type="button" onClick={save} disabled={saving}><Save size={16} />{saving ? "保存中" : "保存"}</button>
        </div>
      </div>
      {notice ? <p className="admin-inline-notice">{notice}</p> : null}
      <div className="table-scroll">
        <table className="result-table">
          <thead><tr><th>姓名</th><th>数量</th><th>操作</th></tr></thead>
          <tbody>
            {records.map((record, index) => (
              <tr key={record.id || `${record.name}-${index}`}>
                <td><input value={record.name} onChange={(event) => updateRecord(index, { name: event.target.value })} placeholder="学员姓名" /></td>
                <td><input type="number" min="0" step="1" value={record.count} onChange={(event) => updateRecord(index, { count: Number(event.target.value) })} /></td>
                <td><button className="icon-button danger" type="button" aria-label={`删除${record.name || "这条记录"}`} onClick={() => removeRecord(index)}><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
