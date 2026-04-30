import { promises as fs } from "node:fs";

const dataPath = `${process.cwd()}/data/account-books.json`;

export type AccountEntryType = "income" | "expense";

export type AccountEntry = {
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

export type AccountHistoryItem = {
  id: string;
  action: string;
  createdAt: string;
  createdBy: string;
  entryCount: number;
  totalIncome: number;
  totalExpense: number;
};

export type AccountBookPayload = {
  entries: AccountEntry[];
  history: AccountHistoryItem[];
};

const defaultCompetitionName = "第32届比赛";
const defaultCreatedBy = "刘一鸣";

export async function readAccountBook(): Promise<AccountBookPayload> {
  try {
    const payload = await fs.readFile(dataPath, "utf-8");
    const parsed = JSON.parse(payload) as Partial<AccountBookPayload> | Partial<AccountEntry>[];
    if (Array.isArray(parsed)) {
      return {
        entries: parsed.map(normalizeEntry).filter(Boolean) as AccountEntry[],
        history: []
      };
    }
    return {
      entries: (parsed.entries || []).map(normalizeEntry).filter(Boolean) as AccountEntry[],
      history: (parsed.history || []).map(normalizeHistoryItem).filter(Boolean) as AccountHistoryItem[]
    };
  } catch {
    return { entries: [], history: [] };
  }
}

export async function writeAccountBook(entries: Partial<AccountEntry>[], action = "保存账本") {
  const current = await readAccountBook();
  await fs.mkdir(`${process.cwd()}/data`, { recursive: true });
  const normalized = entries.map(normalizeEntry).filter(Boolean) as AccountEntry[];
  const historyItem = createHistoryItem(normalized, action);
  const payload = {
    entries: normalized,
    history: [historyItem, ...current.history].slice(0, 100)
  };
  await fs.writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  return payload;
}

function normalizeEntry(entry: Partial<AccountEntry>) {
  const amount = Number(entry.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const type = entry.type === "income" ? "income" : "expense";
  const category = String(entry.category || "").trim();
  if (!category) return null;
  return {
    id: String(entry.id || createEntryId()).trim(),
    competitionName: String(entry.competitionName || defaultCompetitionName).trim() || defaultCompetitionName,
    type,
    category,
    amount,
    date: String(entry.date || "").trim(),
    payerOrPayee: String(entry.payerOrPayee || "").trim(),
    note: String(entry.note || "").trim(),
    createdAt: typeof entry.createdAt === "string" && entry.createdAt.trim() ? entry.createdAt.trim() : new Date().toISOString(),
    createdBy: typeof entry.createdBy === "string" && entry.createdBy.trim() ? entry.createdBy.trim() : defaultCreatedBy
  };
}

function normalizeHistoryItem(item: Partial<AccountHistoryItem>) {
  const entryCount = Number(item.entryCount);
  const totalIncome = Number(item.totalIncome);
  const totalExpense = Number(item.totalExpense);
  if (!item.createdAt || !item.action) return null;
  return {
    id: String(item.id || createEntryId()).trim(),
    action: String(item.action).trim(),
    createdAt: String(item.createdAt).trim(),
    createdBy: String(item.createdBy || defaultCreatedBy).trim() || defaultCreatedBy,
    entryCount: Number.isFinite(entryCount) ? entryCount : 0,
    totalIncome: Number.isFinite(totalIncome) ? totalIncome : 0,
    totalExpense: Number.isFinite(totalExpense) ? totalExpense : 0
  };
}

function createHistoryItem(entries: AccountEntry[], action: string) {
  const totalIncome = entries.filter((entry) => entry.type === "income").reduce((total, entry) => total + entry.amount, 0);
  const totalExpense = entries.filter((entry) => entry.type === "expense").reduce((total, entry) => total + entry.amount, 0);
  return {
    id: createEntryId(),
    action,
    createdAt: new Date().toISOString(),
    createdBy: defaultCreatedBy,
    entryCount: entries.length,
    totalIncome,
    totalExpense
  };
}

function createEntryId() {
  return `ACC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
