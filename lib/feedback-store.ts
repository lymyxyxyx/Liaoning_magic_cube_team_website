import { getPostgresPool } from "@/lib/postgres";

export type FeedbackStatus = "new" | "reviewing" | "resolved";

export type FeedbackMessage = {
  id: string;
  type: string;
  name: string;
  wcaId: string;
  contact: string;
  message: string;
  pageUrl: string;
  status: FeedbackStatus;
  createdAt: string;
  handledAt: string | null;
};

type FeedbackRow = {
  id: string;
  type: string;
  name: string;
  wca_id: string;
  contact: string;
  message: string;
  page_url: string;
  status: FeedbackStatus;
  created_at: Date | string;
  handled_at: Date | string | null;
};

let feedbackTableReady: Promise<void> | undefined;

export function createFeedbackId() {
  return `FB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function ensureFeedbackTable() {
  feedbackTableReady ??= getPostgresPool()
    .query(
      `
        CREATE TABLE IF NOT EXISTS feedback_messages (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL DEFAULT '名单反馈',
          name TEXT NOT NULL DEFAULT '',
          wca_id TEXT NOT NULL DEFAULT '',
          contact TEXT NOT NULL DEFAULT '',
          message TEXT NOT NULL,
          page_url TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved')),
          ip_address TEXT NOT NULL DEFAULT '',
          user_agent TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          handled_at TIMESTAMPTZ
        )
      `
    )
    .then(() => undefined);
  return feedbackTableReady;
}

export async function createFeedbackMessage(input: {
  type: string;
  name?: string;
  wcaId?: string;
  contact?: string;
  message: string;
  pageUrl?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  await ensureFeedbackTable();
  const id = createFeedbackId();
  await getPostgresPool().query(
    `
      INSERT INTO feedback_messages
        (id, type, name, wca_id, contact, message, page_url, ip_address, user_agent)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      id,
      input.type,
      input.name || "",
      input.wcaId || "",
      input.contact || "",
      input.message,
      input.pageUrl || "",
      input.ipAddress || "",
      input.userAgent || ""
    ]
  );
  return id;
}

export async function listFeedbackMessages() {
  await ensureFeedbackTable();
  const result = await getPostgresPool().query<FeedbackRow>(
    `
      SELECT id, type, name, wca_id, contact, message, page_url, status, created_at, handled_at
      FROM feedback_messages
      ORDER BY created_at DESC
      LIMIT 100
    `
  );
  return result.rows.map(mapFeedbackRow);
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus) {
  await ensureFeedbackTable();
  const result = await getPostgresPool().query<FeedbackRow>(
    `
      UPDATE feedback_messages
      SET status = $2,
          handled_at = CASE WHEN $2 = 'resolved' THEN now() ELSE handled_at END
      WHERE id = $1
      RETURNING id, type, name, wca_id, contact, message, page_url, status, created_at, handled_at
    `,
    [id, status]
  );
  return result.rows[0] ? mapFeedbackRow(result.rows[0]) : null;
}

export function isFeedbackStatus(value: string): value is FeedbackStatus {
  return value === "new" || value === "reviewing" || value === "resolved";
}

function mapFeedbackRow(row: FeedbackRow): FeedbackMessage {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    wcaId: row.wca_id,
    contact: row.contact,
    message: row.message,
    pageUrl: row.page_url,
    status: row.status,
    createdAt: toIsoString(row.created_at),
    handledAt: row.handled_at ? toIsoString(row.handled_at) : null
  };
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
