import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

function curl(url) {
  return execFileSync(
    "curl",
    ["-L", "--compressed", "-A", "Mozilla/5.0", "--silent", "--max-time", "30", url],
    { encoding: "utf8" }
  );
}

function stripTags(html) {
  return html
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCompetitionAnchors(html) {
  const anchors = new Map();
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return anchors;

  const tbody = tbodyMatch[1];
  const re = /<a\b[^>]*href="([^"]+\/competition\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(tbody))) {
    const href = match[1];
    const label = stripTags(match[2]);
    if (!href || !label) continue;
    anchors.set(href, label);
  }
  return anchors;
}

function getYearOptionsFromEnglishPage(html) {
  const years = new Set();
  const re = /<option value="(\d{4})">/g;
  let match;
  while ((match = re.exec(html))) years.add(match[1]);
  return Array.from(years).sort();
}

function mergeInto(target, source) {
  for (const [key, value] of source.entries()) {
    if (!target.has(key)) target.set(key, value);
  }
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(rootDir, "data", "cubing-competition-name-zh.json");

const indexEn = curl("https://cubing.com/competition?lang=en");
const years = getYearOptionsFromEnglishPage(indexEn);

const zhByUrl = new Map();

for (const year of years) {
  const url = `https://cubing.com/competition?lang=zh_cn&year=${encodeURIComponent(year)}`;
  const html = curl(url);
  mergeInto(zhByUrl, parseCompetitionAnchors(html));
}

// Also cover "current" view (may include next year).
mergeInto(zhByUrl, parseCompetitionAnchors(curl("https://cubing.com/competition?lang=zh_cn&year=current")));

const result = Object.fromEntries(Array.from(zhByUrl.entries()).sort(([a], [b]) => a.localeCompare(b)));

writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf8");
process.stdout.write(`Wrote ${Object.keys(result).length} items -> ${outPath}\n`);

