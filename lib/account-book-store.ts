import { promises as fs } from "node:fs";
import { getPostgresPool } from "@/lib/postgres";

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
const legacyDataPath = `${process.cwd()}/data/account-books.json`;

export async function readAccountBook(): Promise<AccountBookPayload> {
  const pool = getPostgresPool();
  const [entriesResult, historyResult] = await Promise.all([
    pool.query<{
      id: string;
      competition_name: string;
      type: string;
      category: string;
      amount: string;
      date: string;
      payer_or_payee: string;
      note: string;
      created_at: Date;
      created_by: string;
    }>("SELECT * FROM account_entries ORDER BY date DESC, created_at DESC"),
    pool.query<{
      id: string;
      action: string;
      created_at: Date;
      created_by: string;
      entry_count: string;
      total_income: string;
      total_expense: string;
    }>("SELECT * FROM account_history ORDER BY created_at DESC LIMIT 100")
  ]);

  if (entriesResult.rowCount === 0 && historyResult.rowCount === 0) {
    const imported = await importLegacyAccountBook(pool);
    if (imported) return readAccountBook();
  }

  return {
    entries: entriesResult.rows.map((row) => ({
      id: row.id,
      competitionName: row.competition_name,
      type: row.type as AccountEntryType,
      category: row.category,
      amount: Number(row.amount),
      date: row.date,
      payerOrPayee: row.payer_or_payee,
      note: row.note,
      createdAt: row.created_at.toISOString(),
      createdBy: row.created_by
    })),
    history: historyResult.rows.map((row) => ({
      id: row.id,
      action: row.action,
      createdAt: row.created_at.toISOString(),
      createdBy: row.created_by,
      entryCount: Number(row.entry_count),
      totalIncome: Number(row.total_income),
      totalExpense: Number(row.total_expense)
    }))
  };
}

async function importLegacyAccountBook(pool: ReturnType<typeof getPostgresPool>) {
  const legacy = await readLegacyAccountBook();
  if (!legacy || (legacy.entries.length === 0 && legacy.history.length === 0)) return false;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const entry of legacy.entries) {
      await client.query(
        `INSERT INTO account_entries
          (id, competition_name, type, category, amount, date, payer_or_payee, note, created_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [
          entry.id,
          entry.competitionName,
          entry.type,
          entry.category,
          entry.amount,
          entry.date,
          entry.payerOrPayee,
          entry.note,
          entry.createdAt,
          entry.createdBy
        ]
      );
    }

    const historyItems =
      legacy.history.length > 0 ? legacy.history : [createHistoryItem(legacy.entries, "从旧账本文件自动导入")];
    for (const item of historyItems) {
      await client.query(
        `INSERT INTO account_history
          (id, action, created_at, created_by, entry_count, total_income, total_expense)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [item.id, item.action, item.createdAt, item.createdBy, item.entryCount, item.totalIncome, item.totalExpense]
      );
    }

    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function readLegacyAccountBook(): Promise<AccountBookPayload | null> {
  try {
    const payload = await fs.readFile(legacyDataPath, "utf-8");
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
    return null;
  }
}

export async function writeAccountBook(entries: Partial<AccountEntry>[], action = "保存账本") {
  const pool = getPostgresPool();
  const normalized = entries.map(normalizeEntry).filter(Boolean) as AccountEntry[];
  const historyItem = createHistoryItem(normalized, action);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM account_entries");
    for (const entry of normalized) {
      await client.query(
        `INSERT INTO account_entries
          (id, competition_name, type, category, amount, date, payer_or_payee, note, created_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          entry.id,
          entry.competitionName,
          entry.type,
          entry.category,
          entry.amount,
          entry.date,
          entry.payerOrPayee,
          entry.note,
          entry.createdAt,
          entry.createdBy
        ]
      );
    }

    await client.query(
      `INSERT INTO account_history
        (id, action, created_at, created_by, entry_count, total_income, total_expense)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        historyItem.id,
        historyItem.action,
        historyItem.createdAt,
        historyItem.createdBy,
        historyItem.entryCount,
        historyItem.totalIncome,
        historyItem.totalExpense
      ]
    );

    await client.query(`
      DELETE FROM account_history
      WHERE id NOT IN (
        SELECT id FROM account_history ORDER BY created_at DESC LIMIT 100
      )
    `);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return readAccountBook();
}

function normalizeEntry(entry: Partial<AccountEntry>): AccountEntry | null {
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
    createdAt:
      typeof entry.createdAt === "string" && entry.createdAt.trim() ? entry.createdAt.trim() : new Date().toISOString(),
    createdBy:
      typeof entry.createdBy === "string" && entry.createdBy.trim() ? entry.createdBy.trim() : defaultCreatedBy
  };
}

function normalizeHistoryItem(item: Partial<AccountHistoryItem>): AccountHistoryItem | null {
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

function createHistoryItem(entries: AccountEntry[], action: string): AccountHistoryItem {
  const totalIncome = entries.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = entries.filter((e) => e.type === "expense").reduce((sum, e) => sum + e.amount, 0);
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
