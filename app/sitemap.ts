import type { MetadataRoute } from "next";
import { competitions, people } from "@/lib/data";

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
  "/provincial-competition",
  "/national-events",
  "/weekly",
  "/judges",
  "/commercial-teams",
  "/about"
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries = staticPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified: now
  }));

  const peopleEntries = people.map((person) => ({
    url: `${base}/people/${person.slug}`,
    lastModified: now
  }));

  const competitionEntries = competitions.map((competition) => ({
    url: `${base}/competitions/${competition.slug}`,
    lastModified: now
  }));

  return [...staticEntries, ...peopleEntries, ...competitionEntries];
}
