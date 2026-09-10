#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import pg from "pg";

const inputPath = readOption("--input");
const dryRun = process.argv.includes("--dry-run");

if (!inputPath) throw new Error("Required: --input /path/to/source-fields.json");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const payload = JSON.parse(await readFile(inputPath, "utf8"));
const records = Array.isArray(payload.records) ? payload.records : [];
if (!records.length) throw new Error("Input has no records");

const requiredFields = [
  "meetId",
  "eventCode",
  "playerName",
  "sourceRank",
  "sourceAgeGroup",
  "sourcePersonalBest"
];
const keys = new Set();
for (const [index, record] of records.entries()) {
  for (const field of requiredFields) {
    if (record[field] === undefined || record[field] === null || record[field] === "") {
      throw new Error(`Record ${index + 1} is missing ${field}`);
    }
  }
  if (!Number.isInteger(record.sourceRank) || record.sourceRank < 1) {
    throw new Error(`Record ${index + 1} has an invalid sourceRank`);
  }
  if (!Number.isFinite(Number(record.sourcePersonalBest)) || Number(record.sourcePersonalBest) < 0) {
    throw new Error(`Record ${index + 1} has an invalid sourcePersonalBest`);
  }
  const key = `${record.meetId}:${record.eventCode}:${record.playerName}`;
  if (keys.has(key)) throw new Error(`Duplicate source record: ${key}`);
  keys.add(key);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const record of records) {
    const updated = await client.query(
      `UPDATE weekly_results AS result
          SET source_rank = $1,
              source_age_group = $2,
              level = $3,
              grade = $4,
              source_personal_best = $5,
              updated_at = now()
         FROM weekly_events AS event
        WHERE result.meet_id = $6
          AND event.id = result.event_id
          AND event.meet_id = result.meet_id
          AND event.event_code = $7
          AND result.player_name = $8
      RETURNING result.id`,
      [
        record.sourceRank,
        record.sourceAgeGroup,
        record.level || "",
        record.grade || "",
        Number(record.sourcePersonalBest),
        record.meetId,
        record.eventCode,
        record.playerName
      ]
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        `${record.meetId} ${record.eventCode} ${record.playerName}: expected one result, updated ${updated.rowCount}`
      );
    }
  }

  const expectedByMeet = new Map();
  for (const record of records) {
    expectedByMeet.set(record.meetId, (expectedByMeet.get(record.meetId) || 0) + 1);
  }
  for (const [meetId, expected] of expectedByMeet) {
    const verified = await client.query(
      `SELECT COUNT(*)::int AS count
         FROM weekly_results
        WHERE meet_id = $1
          AND source_rank IS NOT NULL
          AND source_age_group IS NOT NULL
          AND source_personal_best IS NOT NULL`,
      [meetId]
    );
    if (verified.rows[0].count !== expected) {
      throw new Error(`${meetId}: expected ${expected} complete source rows, found ${verified.rows[0].count}`);
    }
  }

  if (dryRun) {
    await client.query("ROLLBACK");
  } else {
    await client.query("COMMIT");
  }
  console.log(JSON.stringify({ ok: true, dryRun, updated: records.length, meets: expectedByMeet.size }));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}
