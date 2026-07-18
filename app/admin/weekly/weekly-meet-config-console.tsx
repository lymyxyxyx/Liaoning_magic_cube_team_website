"use client";

import { CalendarPlus, Save, X } from "lucide-react";
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
  const [isCreating, setIsCreating] = useState(false);
  const [newStartDate, setNewStartDate] = useState(getNextMondayDate());
  const [newEndDate, setNewEndDate] = useState(getDateAfter(newStartDate, 6));
  const [templateMeetId, setTemplateMeetId] = useState(initialMeets[0]?.id || "");
  const [newStatus] = useState<"open">("open");

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
  }, [selected, selectedId]);

  const configByEvent = useMemo(() => new Map(configs.map((config) => [config.eventId, config])), [configs]);

  function updateEvent(eventId: string, patch: Partial<Config>) {
    setConfigs((current) => {
      const existing = current.find((item) => item.eventId === eventId);
      if (existing) return current.map((item) => item.eventId === eventId ? { ...item, ...patch } : item);
      return [...current, { eventId, format: "avg5", enabled: false, seq: current.length, ...patch }];
    });
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

  function openCreator() {
    const start = getNextMondayDate();
    setNewStartDate(start);
    setNewEndDate(getDateAfter(start, 6));
    setTemplateMeetId(selectedId || initialMeets[0]?.id || "");
    setNotice("");
    setIsCreating(true);
  }

  function createMeet() {
    setSaving(true);
    fetch("/api/admin/weekly-competitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: newStartDate, endDate: newEndDate, templateMeetId: templateMeetId || null, status: newStatus })
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as { meet?: Meet; message?: string } | null;
        if (!response.ok || !payload?.meet) throw new Error(payload?.message || "创建周赛失败");
        return payload.meet;
      })
      .then((meet) => {
        setMeets((current) => [meet, ...current]);
        setSelectedId(meet.id);
        setIsCreating(false);
        setNotice("新周赛已生成，项目配置已沿用模板；成绩表为空，可以继续设置开放时间。");
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "创建周赛失败。"))
      .finally(() => setSaving(false));
  }

  return (
    <details className="admin-card weekly-meet-config">
      <summary className="weekly-admin-fold-summary">
        <span>
          <strong>当前周赛配置</strong>
          <small>选择周赛并维护日期、项目和开放时间</small>
        </span>
        <span className="weekly-fold-hint">展开配置</span>
      </summary>
      <div className="weekly-meet-config-toolbar">
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{meets.map((meet) => <option key={meet.id} value={meet.id}>{meet.title}</option>)}</select>
        <button className="button primary" type="button" onClick={openCreator}><CalendarPlus size={16} />新建一周</button>
      </div>
      {selected ? <>
        <div className="weekly-meet-config-fields">
          <label>标题<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>周期<input value={dateLabel} onChange={(event) => setDateLabel(event.target.value)} /></label>
          <label>状态<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">草稿</option><option value="open">开放</option><option value="closed">已截止</option><option value="archived">已归档</option></select></label>
          <label>开始时间（北京时间）<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
          <label>截止时间（北京时间）<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
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
              <details className="weekly-event-config-group weekly-event-config-group--reserved">
                <summary><h3>其他项目（预留）</h3><span>后续再开放</span></summary>
                <p>后续增加项目时，在这里勾选并保存即可。</p>
                {events.filter((event) => !currentEventIds.has(event.id)).map(renderEvent)}
              </details>
            </>;
          })()}
        </div>
        <button className="button primary" type="button" disabled={saving} onClick={save}><Save size={16} />{saving ? "保存中" : "保存周赛配置"}</button>
      </> : null}
      {notice ? <p className="admin-inline-notice">{notice}</p> : null}
      {isCreating ? (
        <div className="weekly-library-dialog-backdrop" role="presentation">
          <div className="weekly-library-dialog" role="dialog" aria-modal="true" aria-labelledby="weekly-create-meet-title">
            <div className="admin-card-heading">
              <div><span className="eyebrow">生成新周期</span><h2 id="weekly-create-meet-title">新建一周周赛</h2><p>只创建周赛和项目配置，不复制任何成绩。</p></div>
              <button className="icon-button" type="button" onClick={() => setIsCreating(false)} aria-label="关闭新建周赛"><X size={17} /></button>
            </div>
            <div className="weekly-library-form">
              <label>开始日期<input type="date" value={newStartDate} onChange={(event) => setNewStartDate(event.target.value)} /></label>
              <label>结束日期<input type="date" value={newEndDate} onChange={(event) => setNewEndDate(event.target.value)} /></label>
              <label>项目模板<select value={templateMeetId} onChange={(event) => setTemplateMeetId(event.target.value)}>{meets.map((meet) => <option key={meet.id} value={meet.id}>{meet.title}</option>)}</select></label>
              <label>开放方式<select value={newStatus} disabled><option value="open">到开始时间自动开放</option></select></label>
            </div>
            <div className="weekly-admin-actions"><button className="button" type="button" onClick={() => setIsCreating(false)} disabled={saving}>取消</button><button className="button primary" type="button" onClick={createMeet} disabled={saving || !newStartDate || !newEndDate}><CalendarPlus size={16} />{saving ? "生成中" : "生成周赛"}</button></div>
          </div>
        </div>
      ) : null}
    </details>
  );
}

function toLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function getNextMondayDate() {
  const date = new Date();
  const daysUntilMonday = (8 - (date.getDay() || 7)) % 7 || 7;
  date.setDate(date.getDate() + daysUntilMonday);
  return formatDateInput(date);
}

function getDateAfter(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
