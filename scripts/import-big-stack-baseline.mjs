#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";

if (!process.argv.includes("--confirm-baseline")) {
  console.error("This command replaces every current 3x3 big-stack record. Re-run with --confirm-baseline after reviewing the baseline JSON.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const baselinePath = path.join(process.cwd(), "data", "big-stack-baseline.json");
const rows = JSON.parse(await fs.readFile(baselinePath, "utf8"));
if (!Array.isArray(rows) || rows.length !== 805) throw new Error(`Expected 805 baseline rows, received ${Array.isArray(rows) ? rows.length : "invalid JSON"}`);
if (new Set(rows.map((row) => row.name)).size !== rows.length) throw new Error("Baseline contains duplicate names");
if (rows.filter((row) => row.name === "刘奕辰" && row.count === 64).length !== 1) throw new Error("刘奕辰 baseline mismatch");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const table = await client.query("SELECT to_regclass('public.weekly_big_stack_records')::text AS name");
  if (!table.rows[0]?.name) throw new Error("weekly_big_stack_records does not exist; run npm run db:migrate first");
  const columns = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'weekly_big_stack_records'");
  if (!columns.rows.some((row) => row.column_name === "player_id")) throw new Error("Long-term PB migration is missing; run npm run db:migrate first");
  await client.query("LOCK TABLE weekly_big_stack_records IN EXCLUSIVE MODE");

  const players = (await client.query("SELECT id, name, wca_id FROM weekly_player_library")).rows;
  const playersByName = new Map();
  for (const player of players) playersByName.set(player.name.trim(), [...(playersByName.get(player.name.trim()) || []), player]);
  const records = rows.map((row) => {
    const matches = playersByName.get(row.name.trim()) || [];
    const player = matches.length === 1 ? matches[0] : null;
    return {
      id: `big-stack-${randomUUID()}`,
      name: row.name.trim(),
      solve_count: Number(row.count),
      player_id: player?.id || "",
      wca_id: player?.wca_id || "",
      source_label: "大堆记录-修正版.xlsx（805人权威基线）"
    };
  });
  const resolvedKeys = records.filter((record) => record.player_id).map((record) => record.player_id);
  if (new Set(resolvedKeys).size !== resolvedKeys.length) throw new Error("Multiple baseline rows resolved to the same weekly player");
  const batchId = randomUUID();
  const unresolved = records.filter((record) => !record.player_id).length;

  await client.query("DELETE FROM weekly_big_stack_records WHERE event_code = '333'");
  await client.query(`
    INSERT INTO weekly_big_stack_records
      (id, name, event_code, solve_count, player_id, wca_id, meet_id, source_label, note, updated_at)
    SELECT x.id, x.name, '333', x.solve_count, NULLIF(x.player_id, ''), x.wca_id, NULL, x.source_label, '', now()
      FROM jsonb_to_recordset($1::jsonb) AS x(
        id TEXT, name TEXT, solve_count INTEGER, player_id TEXT, wca_id TEXT, source_label TEXT
      )
  `, [JSON.stringify(records)]);
  await client.query(`
    INSERT INTO weekly_big_stack_record_revisions
      (record_id, action, reason, before_record, after_record, points_awarded, import_batch_id)
    SELECT id, 'baseline', '权威基线导入', NULL, to_jsonb(record), 0, $1
      FROM weekly_big_stack_records record
     WHERE event_code = '333'
  `, [batchId]);
  await client.query(
    `INSERT INTO weekly_big_stack_import_batches (id, filename, event_code, mode, summary)
     VALUES ($1, $2, '333', 'baseline', $3::jsonb)`,
    [batchId, "大堆记录-修正版.xlsx", JSON.stringify({ total: records.length, replace: records.length, unresolved })]
  );
  await client.query("COMMIT");
  console.log(JSON.stringify({ imported: records.length, exactPlayerMatches: records.length - unresolved, unresolved, batchId }));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
