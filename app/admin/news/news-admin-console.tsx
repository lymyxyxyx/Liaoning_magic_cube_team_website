"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Field } from "@/components/field";
import { newsTags, type NewsItem } from "@/lib/news-types";

function createDraft(): NewsItem {
  return {
    id: `news-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    slug: "",
    title: "",
    date: new Date().toISOString().slice(0, 10),
    summary: "",
    body: "",
    tag: "公告",
    published: true,
    createdAt: new Date().toISOString()
  };
}

export function NewsAdminConsole() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState("读取中…");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/admin/news");
        if (!response.ok) throw new Error("读取失败");
        const data = await response.json();
        setItems(Array.isArray(data.news) ? data.news : []);
        setStatus("");
      } catch {
        setStatus("读取新闻失败，请刷新重试。");
      }
    })();
  }, []);

  function update(index: number, patch: Partial<NewsItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((current) => [createDraft(), ...current]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    setStatus("保存中…");
    try {
      const response = await fetch("/api/admin/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ news: items })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "保存失败");
      setItems(Array.isArray(data.news) ? data.news : []);
      setStatus("已保存。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="container section">
      <div className="news-admin-toolbar">
        <button className="button" type="button" onClick={addItem}>
          <Plus size={16} />
          新增新闻
        </button>
        <button className="button primary" type="button" onClick={save} disabled={saving}>
          <Save size={16} />
          保存全部
        </button>
        {status ? <span className="news-admin-status">{status}</span> : null}
      </div>

      <datalist id="news-tags">
        {newsTags.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>

      {items.length === 0 ? (
        <div className="news-empty">还没有新闻，点击「新增新闻」开始。</div>
      ) : (
        <div className="news-admin-list">
          {items.map((item, index) => (
            <div className="news-admin-card" key={item.id}>
              <div className="news-admin-card-head">
                <strong>{item.title || "（未命名新闻）"}</strong>
                <button
                  className="news-admin-delete"
                  type="button"
                  onClick={() => removeItem(index)}
                  aria-label="删除"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="form-grid">
                <Field label="标题" value={item.title} onChange={(v) => update(index, { title: v })} full />
                <Field label="日期" type="date" value={item.date} onChange={(v) => update(index, { date: v })} />
                <Field
                  label="分类"
                  value={item.tag || ""}
                  onChange={(v) => update(index, { tag: v })}
                  list="news-tags"
                />
                <Field
                  label="自定义链接 slug（可留空，用于网址）"
                  value={item.slug}
                  onChange={(v) => update(index, { slug: v })}
                  placeholder="如 2026-shenyang-open"
                />
                <Field
                  label="封面图 URL（可选）"
                  value={item.cover || ""}
                  onChange={(v) => update(index, { cover: v })}
                  full
                  placeholder="https://…"
                />
                <Field
                  label="摘要"
                  value={item.summary}
                  onChange={(v) => update(index, { summary: v })}
                  full
                  textarea
                />
                <Field
                  label="正文（空行分段）"
                  value={item.body}
                  onChange={(v) => update(index, { body: v })}
                  full
                  textarea
                />
                <Field
                  label="原文外链（可选）"
                  value={item.externalUrl || ""}
                  onChange={(v) => update(index, { externalUrl: v })}
                  full
                  placeholder="https://…"
                />
              </div>
              <label className="news-admin-published">
                <input
                  type="checkbox"
                  checked={item.published}
                  onChange={(event) => update(index, { published: event.target.checked })}
                />
                已发布（取消勾选为草稿，前台不显示）
              </label>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
