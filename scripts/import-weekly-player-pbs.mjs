#!/usr/bin/env node

import fs from "node:fs/promises";
import { Client } from "pg";

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error("Usage: node scripts/import-weekly-player-pbs.mjs <personal-bests.json>");
}

const supportedEvents = new Set(["333", "222", "pyram", "mirror", "skewb", "allAround"]);
const sourceLabel = "个人PB.xlsx（2026-07）";

const rawEntries = JSON.parse(await fs.readFile(inputPath, "utf8"));
if (!Array.isArray(rawEntries)) throw new Error("PB import file must be a JSON array");

const entriesByName = new Map();
for (const raw of rawEntries) {
  const name = String(raw?.name || "").trim();
  if (!name) continue;
  const personalBests = normalizePersonalBests(raw?.personalBests);
  if (Object.keys(personalBests).length === 0) continue;
  entriesByName.set(name, { name, personalBests });
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("BEGIN");
  await client.query("ALTER TABLE weekly_player_library ADD COLUMN IF NOT EXISTS personal_bests JSONB NOT NULL DEFAULT '{}'::jsonb");

  const { rows } = await client.query("SELECT id, name FROM weekly_player_library");
  const existingIdByName = new Map(rows.map((row) => [row.name, row.id]));
  let matched = 0;
  let created = 0;

  for (const entry of entriesByName.values()) {
    const existingId = existingIdByName.get(entry.name);
    const id = existingId || `weekly-pb-${slugifyName(entry.name)}`;
    if (existingId) matched += 1;
    else created += 1;

    await client.query(
      `INSERT INTO weekly_player_library (id, name, province, source, personal_bests, updated_at)
       VALUES ($1, $2, '辽宁', $3, $4::jsonb, now())
       ON CONFLICT (id) DO UPDATE
         SET personal_bests = EXCLUDED.personal_bests,
             province = CASE WHEN weekly_player_library.province = '' THEN EXCLUDED.province ELSE weekly_player_library.province END,
             source = CASE
               WHEN weekly_player_library.source = '' THEN EXCLUDED.source
               WHEN weekly_player_library.source LIKE '%个人PB.xlsx%' THEN weekly_player_library.source
               ELSE weekly_player_library.source || '；' || EXCLUDED.source
             END,
             updated_at = now()`,
      [id, entry.name, sourceLabel, JSON.stringify(entry.personalBests)]
    );
  }

  await client.query("COMMIT");
  console.log(JSON.stringify({ imported: entriesByName.size, matched, created }));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

function normalizePersonalBests(value) {
  if (!value || typeof value !== "object") return {};
  const next = {};
  for (const [eventId, rawScore] of Object.entries(value)) {
    const score = Number(rawScore);
    if (supportedEvents.has(eventId) && Number.isFinite(score) && score > 0) next[eventId] = score;
  }
  return next;
}

function slugifyName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "") || Date.now().toString(36);
}
