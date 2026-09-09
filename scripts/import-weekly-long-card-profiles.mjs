#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("Usage: DATABASE_URL=... node scripts/import-weekly-long-card-profiles.mjs <profiles.json>");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function matchKey(value) {
  return clean(value).replace(/[\s　]+/g, "").replace(/[（(][^（）()]*[）)]/g, "");
}

const payload = JSON.parse(await readFile(inputPath, "utf8"));
const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
if (profiles.length === 0) throw new Error("No profiles found in input JSON");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  const playersResult = await client.query("SELECT id, name FROM weekly_player_library WHERE source <> 'legacy_seed'");
  const playerIdsByName = new Map();
  for (const player of playersResult.rows) {
    const key = matchKey(player.name);
    if (!key) continue;
    const ids = playerIdsByName.get(key) || [];
    ids.push(player.id);
    playerIdsByName.set(key, ids);
  }

  let matched = 0;
  let unmatched = 0;
  await client.query("BEGIN");
  for (const [index, input] of profiles.entries()) {
    const rowNumber = Number(input.sourceRowNumber || index + 2);
    const name = clean(input.name);
    if (!Number.isInteger(rowNumber) || rowNumber < 2 || !name) throw new Error(`Invalid long-card row ${index + 1}`);
    const candidates = playerIdsByName.get(matchKey(name)) || [];
    const playerId = candidates.length === 1 ? candidates[0] : null;
    if (playerId) matched += 1;
    else unmatched += 1;
    await client.query(
      `INSERT INTO weekly_long_card_profiles
        (source_row_number, source_file, submitted_at, student_name, gender, birth_date, phone, contact_relationship, channel, source_notes, matched_player_id, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
       ON CONFLICT (source_row_number) DO UPDATE SET
         source_file = EXCLUDED.source_file, submitted_at = EXCLUDED.submitted_at, student_name = EXCLUDED.student_name,
         gender = EXCLUDED.gender, birth_date = EXCLUDED.birth_date, phone = EXCLUDED.phone,
         contact_relationship = EXCLUDED.contact_relationship, channel = EXCLUDED.channel,
         source_notes = EXCLUDED.source_notes, matched_player_id = EXCLUDED.matched_player_id, updated_at = now()`,
      [rowNumber, clean(payload.sourceFile) || path.basename(inputPath), clean(input.submittedAt), name, clean(input.gender), clean(input.birthDate), clean(input.phone), clean(input.contactRelationship), clean(input.channel), clean(input.notes), playerId]
    );
  }
  await client.query("COMMIT");
  console.log(JSON.stringify({ imported: profiles.length, matched, unmatched }));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
