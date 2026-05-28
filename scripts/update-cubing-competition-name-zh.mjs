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

const zhByUrl = new Map();

function buildUrl(params) {
  const searchParams = new URLSearchParams(params);
  return `https://cubing.com/competition?${searchParams.toString()}`;
}

function crawlCompetitionListPages(params) {
  const merged = new Map();
  for (let page = 1; page <= 200; page += 1) {
    const url = buildUrl({ ...params, page: page === 1 ? "" : String(page) });
    const html = curl(url);
    const items = parseCompetitionAnchors(html);
    const before = merged.size;
    mergeInto(merged, items);
    const after = merged.size;
    if (items.size === 0) break;
    if (after === before) break;
  }
  return merged;
}

// Crawl the full list (handles pagination) - this is the only reliable way to capture older competitions.
mergeInto(
  zhByUrl,
  crawlCompetitionListPages({
    lang: "zh_cn",
    year: "",
    type: "",
    province: "",
    event: ""
  })
);

// Also crawl "current" view (sometimes differs from the full list).
mergeInto(
  zhByUrl,
  crawlCompetitionListPages({
    lang: "zh_cn",
    year: "current",
    type: "",
    province: "",
    event: ""
  })
);

const result = Object.fromEntries(Array.from(zhByUrl.entries()).sort(([a], [b]) => a.localeCompare(b)));

writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf8");
process.stdout.write(`Wrote ${Object.keys(result).length} items -> ${outPath}\n`);
