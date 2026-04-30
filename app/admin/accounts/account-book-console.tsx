"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";

type AccountEntryType = "income" | "expense";

type AccountEntry = {
  id: string;
  competitionName: string;
  type: AccountEntryType;
  category: string;
  amount: number;
  date: string;
  payerOrPayee: string;
  note: string;
  createdAt?: string;
  createdBy?: string;
};

type AccountHistoryItem = {
  id: string;
  action: string;
  createdAt: string;
  createdBy: string;
  entryCount: number;
  totalIncome: number;
  totalExpense: number;
};

const defaultCreatedBy = "刘一鸣";
const defaultCompetitionName = "第32届比赛";
const incomeCategories = ["报名费", "赞助", "周边销售", "其他收入"];
const expenseCategories = ["场地", "物料", "奖品", "裁判/工作人员", "宣传", "餐饮", "交通", "其他支出"];

const emptyEntry = {
  competitionName: defaultCompetitionName,
  type: "income" as AccountEntryType,
  category: "报名费",
  amount: "",
  date: "",
  payerOrPayee: "",
  note: ""
};

export function AccountBookConsole() {
  const [entries, setEntries] = useState<AccountEntry[]>([]);
  const [history, setHistory] = useState<AccountHistoryItem[]>([]);
  const [draft, setDraft] = useState(emptyEntry);
  const [status, setStatus] = useState("读取中");
  const [notice, setNotice] = useState("");
  const [competitionFilter, setCompetitionFilter] = useState(defaultCompetitionName);

  useEffect(() => {
    fetch("/api/account-books")
      .then((response) => response.json())
      .then((payload) => {
        const nextEntries = payload.entries || [];
        setEntries(nextEntries);
        setHistory(payload.history || []);
        setStatus("已读取");
      })
      .catch(() => setStatus("读取失败"));
  }, []);

  const competitions = useMemo(() => {
    const names = entries.map((entry) => entry.competitionName).filter(Boolean);
    return Array.from(new Set([defaultCompetitionName, ...names]));
  }, [entries]);

  const visibleEntries = useMemo(
    () => entries.filter((entry) => entry.competitionName === competitionFilter),
    [competitionFilter, entries]
  );

  const summary = useMemo(() => {
    const income = visibleEntries.filter((entry) => entry.type === "income").reduce((total, entry) => total + entry.amount, 0);
    const expense = visibleEntries.filter((entry) => entry.type === "expense").reduce((total, entry) => total + entry.amount, 0);
    const categoryTotals = new Map<string, number>();
    for (const entry of visibleEntries) {
      const key = `${entry.type === "income" ? "收入" : "支出"}：${entry.category}`;
      categoryTotals.set(key, (categoryTotals.get(key) || 0) + entry.amount);
    }
    return {
      income,
      expense,
      balance: income - expense,
      categoryTotals: Array.from(categoryTotals.entries())
    };
  }, [visibleEntries]);

  function addEntry() {
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice("请输入正确的金额。");
      return;
    }
    if (!draft.category.trim()) {
      setNotice("请选择或填写分类。");
      return;
    }
    const nextEntry = {
      id: createEntryId(),
      competitionName: draft.competitionName.trim() || defaultCompetitionName,
      type: draft.type,
      category: draft.category.trim(),
      amount,
      date: draft.date,
      payerOrPayee: draft.payerOrPayee.trim(),
      note: draft.note.trim(),
      createdAt: new Date().toISOString(),
      createdBy: defaultCreatedBy
    };
    const nextEntries = [nextEntry, ...entries];
    setEntries(nextEntries);
    setCompetitionFilter(nextEntry.competitionName);
    setDraft({ ...emptyEntry, competitionName: nextEntry.competitionName, type: draft.type, category: draft.category });
    saveEntries(nextEntries, "账目已新增并保存。", `新增账目：${nextEntry.category}`);
  }

function updateEntry(id: string, next: Partial<AccountEntry>) {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...next } : entry)));
    setStatus("有未保存修改");
  }

  function removeEntry(id: string) {
    if (!window.confirm("确认删除这条账目？")) return;
    setEntries((current) => current.filter((entry) => entry.id !== id));
    setStatus("有未保存修改");
  }

  function saveEntries(nextEntries = entries, successNotice = "账本已保存。", action = "保存账本修改") {
    const normalizedEntries = nextEntries.map(mergePayeeIntoNote);
    setStatus("保存中");
    fetch("/api/account-books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: normalizedEntries, action })
    })
      .then((response) => response.json())
      .then((payload) => {
        setEntries(payload.entries || []);
        setHistory(payload.history || []);
        setStatus("已保存");
        setNotice(successNotice);
      })
      .catch(() => {
        setStatus("保存失败");
        setNotice("保存失败，请稍后重试。");
      });
  }

  const categories = draft.type === "income" ? incomeCategories : expenseCategories;

  return (
    <section className="container section admin-console-shell">
      <div className="admin-workspace-heading">
        <div>
          <h1>第32届账本</h1>
          <p>按收入、支出和分类汇总比赛账目，保存后写入服务器数据文件。</p>
        </div>
        <span className="status">{status}</span>
      </div>

      <div className="stat-band admin-profile-stats">
        <div className="stat">
          <strong>{formatCurrency(summary.income)}</strong>
          <span>总收入</span>
        </div>
        <div className="stat">
          <strong>{formatCurrency(summary.expense)}</strong>
          <span>总支出</span>
        </div>
        <div className="stat">
          <strong>{formatCurrency(summary.balance)}</strong>
          <span>结余</span>
        </div>
        <div className="stat">
          <strong>{visibleEntries.length}</strong>
          <span>账目条数</span>
        </div>
      </div>

      <div className="account-workbench">
        <div className="admin-card account-ledger">
          <div className="admin-card-heading">
            <div>
              <h2>账目明细</h2>
              <p>选择比赛后查看和编辑对应收入支出。</p>
            </div>
          </div>

          <label className="field account-competition-filter">
            比赛
            <select value={competitionFilter} onChange={(event) => setCompetitionFilter(event.target.value)}>
              {competitions.map((name) => (
                <option value={name} key={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <div className="account-category-summary">
            {summary.categoryTotals.length === 0 ? <span>暂无分类小计</span> : null}
            {summary.categoryTotals.map(([name, total]) => (
              <span key={name}>
                {name} {formatCurrency(total)}
              </span>
            ))}
          </div>

          <div className="result-table-wrap account-table">
            <table className="result-table">
              <thead>
                <tr>
                  <th>类型</th>
                  <th>分类</th>
                  <th>金额</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <select value={entry.type} onChange={(event) => updateEntry(entry.id, { type: event.target.value as AccountEntryType })}>
                        <option value="income">收入</option>
                        <option value="expense">支出</option>
                      </select>
                    </td>
                    <td>
                      <input value={entry.category} onChange={(event) => updateEntry(entry.id, { category: event.target.value })} />
                    </td>
                    <td>
                      <input
                        inputMode="decimal"
                        value={entry.amount}
                        onChange={(event) => updateEntry(entry.id, { amount: Number(event.target.value) || 0 })}
                      />
                    </td>
                    <td>
                      <input value={formatEntryNote(entry)} onChange={(event) => updateEntry(entry.id, { note: event.target.value, payerOrPayee: "" })} />
                    </td>
                    <td>
                      <button className="button" type="button" onClick={() => removeEntry(entry.id)}>
                        <Trash2 size={16} />
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
                {visibleEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5}>这场比赛还没有账目。</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <button className="button primary account-save-button" type="button" onClick={() => saveEntries()}>
            <Save size={17} />
            保存账本修改
          </button>
          {notice ? <p className="admin-inline-notice">{notice}</p> : null}

          <div className="account-history">
            <h3>保存历史</h3>
            {history.length === 0 ? <p>暂无保存历史。</p> : null}
            {history.slice(0, 8).map((item) => (
              <div className="account-history-item" key={item.id}>
                <strong>{item.action}</strong>
                <span>
                  {formatDateTime(item.createdAt)} · {item.createdBy} · {item.entryCount} 条 · 收入 {formatCurrency(item.totalIncome)} · 支出{" "}
                  {formatCurrency(item.totalExpense)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <aside className="admin-card account-entry-panel">
          <h2>新增账目</h2>
          <div className="form-grid admin-entry-form">
            <Field label="比赛名称" value={draft.competitionName} onChange={(value) => setDraft({ ...draft, competitionName: value })} />
            <label className="field">
              类型
              <select
                value={draft.type}
                onChange={(event) => {
                  const type = event.target.value as AccountEntryType;
                  setDraft({ ...draft, type, category: type === "income" ? incomeCategories[0] : expenseCategories[0] });
                }}
              >
                <option value="income">收入</option>
                <option value="expense">支出</option>
              </select>
            </label>
            <label className="field">
              分类
              <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
                {categories.map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <Field label="金额" value={draft.amount} onChange={(value) => setDraft({ ...draft, amount: value })} />
            <Field label="备注" value={draft.note} onChange={(value) => setDraft({ ...draft, note: value })} />
          </div>
          <button className="button primary account-save-button" type="button" onClick={addEntry}>
            <Plus size={17} />
            新增并保存
          </button>
        </aside>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="field">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function createEntryId() {
  return `ACC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 }).format(value);
}

function formatEntryNote(entry: AccountEntry) {
  if (!entry.payerOrPayee) return entry.note;
  if (!entry.note) return entry.payerOrPayee;
  if (entry.note.includes(entry.payerOrPayee)) return entry.note;
  return `${entry.payerOrPayee}；${entry.note}`;
}

function mergePayeeIntoNote(entry: AccountEntry) {
  return {
    ...entry,
    note: formatEntryNote(entry),
    payerOrPayee: ""
  };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
