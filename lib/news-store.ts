import { readAppDocument, writeAppDocument } from "@/lib/app-document-store";
import type { NewsItem } from "@/lib/news-types";

const dataPath = `${process.cwd()}/data/news.json`;
export type { NewsItem } from "@/lib/news-types";

type RawNews = Partial<NewsItem>;

export async function readNews(): Promise<NewsItem[]> {
  const raw = await readAppDocument<RawNews>("news", dataPath);
  return normalizeNews(raw ?? []);
}

export async function writeNews(items: RawNews[]) {
  const normalized = normalizeNews(items);
  await writeAppDocument("news", dataPath, normalized);
  return normalized;
}

/** Published items, newest first. */
export async function getPublishedNews(limit?: number): Promise<NewsItem[]> {
  const items = (await readNews())
    .filter((item) => item.published)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return typeof limit === "number" ? items.slice(0, limit) : items;
}

export async function getNewsBySlug(slug: string): Promise<NewsItem | undefined> {
  return (await readNews()).find((item) => item.slug === slug);
}

function normalizeNews(items: RawNews[]): NewsItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const id = String(item.id || "").trim() || createNewsId();
      const title = String(item.title || "").trim();
      if (!title) return null;
      const slug = (String(item.slug || "").trim() || id).replace(/\s+/g, "-");
      const cover = String(item.cover || "").trim();
      const tag = String(item.tag || "").trim();
      const externalUrl = String(item.externalUrl || "").trim();
      return {
        id,
        slug,
        title,
        date: String(item.date || "").trim() || new Date().toISOString().slice(0, 10),
        summary: String(item.summary || "").trim(),
        body: String(item.body || ""),
        ...(cover ? { cover } : {}),
        ...(tag ? { tag } : {}),
        ...(externalUrl ? { externalUrl } : {}),
        published: item.published !== false,
        createdAt:
          typeof item.createdAt === "string" && item.createdAt ? item.createdAt : new Date().toISOString()
      } satisfies NewsItem;
    })
    .filter(Boolean) as NewsItem[];
}

function createNewsId() {
  return `news-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
