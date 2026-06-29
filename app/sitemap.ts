import type { MetadataRoute } from "next";
import { competitions, people } from "@/lib/data";
import { getPublishedNews } from "@/lib/news-store";

const base = "https://lncubing.com";

// Public, indexable routes. Gated pages (/coaches, /athletes), admin and API
// routes are intentionally excluded.
const staticPaths = [
  "",
  "/liaoning-rankings",
  "/liaoning-records",
  "/rankings",
  "/sum-of-ranks",
  "/competitions",
  "/liaoning-competitions",
  "/provincial-competition",
  "/national-events",
  "/weekly",
  "/judges",
  "/commercial-teams",
  "/news",
  "/about",
  "/privacy"
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries = staticPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified: now
  }));

  const news = await getPublishedNews();
  const newsEntries = news.map((item) => ({
    url: `${base}/news/${item.slug}`,
    lastModified: item.date ? new Date(item.date) : now
  }));

  const peopleEntries = people.map((person) => ({
    url: `${base}/people/${person.slug}`,
    lastModified: now
  }));

  const competitionEntries = competitions.map((competition) => ({
    url: `${base}/competitions/${competition.slug}`,
    lastModified: now
  }));

  return [...staticEntries, ...newsEntries, ...peopleEntries, ...competitionEntries];
}
