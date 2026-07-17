"use client";

import { Plus, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { weeklyResultFormats, type WeeklyResultFormat } from "@/lib/weekly-result-utils";
import { WEEKLY_DEFAULT_EVENT_IDS } from "@/lib/wca-events";
import type { WCA_EVENTS } from "@/lib/wca-events";

type Meet = { id: string; title: string; dateLabel: string; status?: string; startsAt?: string | null; endsAt?: string | null };
type Config = { eventId: string; format: WeeklyResultFormat; enabled: boolean; seq: number };

export function WeeklyMeetConfigConsole({ initialMeets, events }: { initialMeets: Meet[]; events: ReadonlyArray<(typeof WCA_EVENTS)[number]> }) {
  const [meets, setMeets] = useState(initialMeets);
  const [selectedId, setSelectedId] = useState(initialMeets[0]?.id || "");
  const selected = meets.find((meet) => meet.id === selectedId);
  const [title, setTitle] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [status, setStatus] = useState("draft");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [configs, setConfigs] = useState<Config[]>([]);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setDateLabel(selected.dateLabel);
    setStatus(selected.status || "draft");
    setStartsAt(toLocalValue(selected.startsAt));
    setEndsAt(toLocalValue(selected.endsAt));
    fetch(`/api/admin/weekly-competitions/${encodeURIComponent(selected.id)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("读取配置失败")))
      .then((payload: { eventConfigs: Config[] }) => setConfigs(payload.eventConfigs || []))
      .catch((error) => setNotice(error instanceof Error ? error.message : "读取配置失败。"));
  }, [selectedId]);

  const configByEvent = useMemo(() => new Map(configs.map((config) => [config.eventId, config])), [configs]);

  function updateEvent(eventId: string, patch: Partial<Config>) {
    setConfigs((current) => {
      const existing = current.find((item) => item.eventId === eventId);
      if (existing) return current.map((item) => item.eventId === eventId ? { ...item, ...patch } : item);
      return [...current, { eventId, format: "avg5", enabled: false, seq: current.length, ...patch }];
    });
  }

  function createMeet() {
    setSaving(true);
    fetch("/api/admin/weekly-competitions", { method: "POST" })
      .then((response) => response.ok ? response.json() : response.json().then((body) => Promise.reject(new Error(body.message || "新建失败"))))
      .then((payload: { meet: Meet }) => {
        setMeets((current) => [payload.meet, ...current]);
        setSelectedId(payload.meet.id);
        setNotice("已新建下一周周赛，请完成配置后再开放。");
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "新建周赛失败。"))
      .finally(() => setSaving(false));
  }

  function save() {
    if (!selected) return;
    setSaving(true);
    fetch(`/api/admin/weekly-competitions/${encodeURIComponent(selected.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, dateLabel, status, startsAt: startsAt || null, endsAt: endsAt || null, eventConfigs: configs })
    })
      .then((response) => response.ok ? response.json() : response.json().then((body) => Promise.reject(new Error(body.message || "保存失败"))))
      .then(() => {
        setMeets((current) => current.map((meet) => meet.id === selected.id ? { ...meet, title, dateLabel, status, startsAt, endsAt } : meet));
        setNotice(status === "open" ? "周赛已开放，前台会优先显示这一场。" : "周赛配置已保存。" );
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "保存周赛配置失败。"))
      .finally(() => setSaving(false));
  }

  return (
    <section className="admin-card weekly-meet-config">
      <div className="admin-card-heading"><div><h2>当前周赛配置</h2><p>开放状态的周赛会成为前台“立即参加”的默认场次。</p></div></div>
      <div className="weekly-meet-config-toolbar">
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{meets.map((meet) => <option key={meet.id} value={meet.id}>{meet.title}</option>)}</select>
        <button className="button" type="button" onClick={createMeet} disabled={saving}><Plus size={16} />新建下一周</button>
      </div>
      {selected ? <>
        <div className="weekly-meet-config-fields">
          <label>标题<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>周期<input value={dateLabel} onChange={(event) => setDateLabel(event.target.value)} /></label>
          <label>状态<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">草稿</option><option value="open">开放</option><option value="closed">已截止</option><option value="archived">已归档</option></select></label>
          <label>开始时间<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
          <label>截止时间<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
        </div>
        <div className="weekly-meet-event-configs">
          {(() => {
            const currentEventIds = new Set<string>(WEEKLY_DEFAULT_EVENT_IDS);
            const renderEvent = (event: (typeof WCA_EVENTS)[number]) => {
              const config = configByEvent.get(event.id) || { eventId: event.id, format: "avg5" as const, enabled: false, seq: configs.length };
              const availableFormats = weeklyResultFormats.filter((format) => event.id === "individual" ? format.id === "best1" : format.id === "avg5" || format.id === "best3");
              const selectedFormat = availableFormats.some((format) => format.id === config.format) ? config.format : availableFormats[0].id;
              return <div key={event.id}><label><input type="checkbox" checked={config.enabled} onChange={(input) => updateEvent(event.id, { enabled: input.target.checked })} />{event.name}</label><select value={selectedFormat} onChange={(input) => updateEvent(event.id, { format: input.target.value as WeeklyResultFormat })}>{availableFormats.map((format) => <option key={format.id} value={format.id}>{format.name}</option>)}</select></div>;
            };
            return <>
              <section className="weekly-event-config-group">
                <h3>当前周赛项目</h3>
                <p>本周默认开放以下六个项目；个人全能暂不适用段位等级标准。</p>
                {events.filter((event) => currentEventIds.has(event.id)).map(renderEvent)}
              </section>
              <section className="weekly-event-config-group weekly-event-config-group--reserved">
                <h3>其他项目（预留）</h3>
                <p>后续增加项目时，在这里勾选并保存即可。</p>
                {events.filter((event) => !currentEventIds.has(event.id)).map(renderEvent)}
              </section>
            </>;
          })()}
        </div>
        <button className="button primary" type="button" disabled={saving} onClick={save}><Save size={16} />{saving ? "保存中" : "保存周赛配置"}</button>
      </> : null}
      {notice ? <p className="admin-inline-notice">{notice}</p> : null}
    </section>
  );
}

function toLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
