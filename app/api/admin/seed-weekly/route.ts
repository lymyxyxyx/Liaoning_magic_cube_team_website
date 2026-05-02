import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres";
import { weeklyMeets } from "@/lib/weekly";

export const dynamic = "force-dynamic";

// One-time migration: reads data from lib/weekly.ts and inserts into PostgreSQL.
// Only callable when authenticated (protected by middleware).
// Safe to call multiple times — uses INSERT ... ON CONFLICT DO NOTHING.
export async function POST() {
  const pool = getPostgresPool();
  const client = await pool.connect();

  let meetsInserted = 0;
  let resultsInserted = 0;

  try {
    await client.query("BEGIN");

    for (const meet of weeklyMeets) {
      const { rowCount } = await client.query(
        `INSERT INTO weekly_meets
          (id, slug, title, week_number, year, year_week, published_at,
           event, date_label, summary, pb_note, three_age_intro)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO NOTHING`,
        [
          meet.id,
          meet.slug,
          meet.title,
          meet.weekNumber,
          meet.year,
          meet.yearWeek,
          meet.publishedAt ?? null,
          meet.event,
          meet.dateLabel,
          meet.summary,
          meet.pbNote,
          meet.threeAgeIntro
        ]
      );
      if ((rowCount ?? 0) === 0) continue; // already seeded
      meetsInserted++;

      // Intro paragraphs
      for (let i = 0; i < meet.intro.length; i++) {
        await client.query(
          "INSERT INTO weekly_meet_intros (meet_id, seq, text) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
          [meet.id, i, meet.intro[i]]
        );
      }

      // Main results event
      const mainEventId = "main";
      await client.query(
        `INSERT INTO weekly_events (id, meet_id, kind, title, event_name, group_name, is_all_around, seq)
         VALUES ($1,$2,'main',$3,$4,NULL,FALSE,0) ON CONFLICT DO NOTHING`,
        [mainEventId, meet.id, `三阶比赛第${meet.yearWeek}周`, "三阶"]
      );
      resultsInserted += await insertResults(client, mainEventId, meet.id, meet.results);

      // Age-group events
      for (let i = 0; i < meet.threeAgeGroups.length; i++) {
        const ev = meet.threeAgeGroups[i];
        await client.query(
          `INSERT INTO weekly_events (id, meet_id, kind, title, event_name, group_name, is_all_around, seq)
           VALUES ($1,$2,'age_group',$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
          [ev.id, meet.id, ev.title, ev.eventName, ev.groupName ?? null, ev.isAllAround ?? false, i]
        );
        resultsInserted += await insertResults(client, ev.id, meet.id, ev.results);
      }

      // Other events
      for (let i = 0; i < meet.events.length; i++) {
        const ev = meet.events[i];
        await client.query(
          `INSERT INTO weekly_events (id, meet_id, kind, title, event_name, group_name, is_all_around, seq)
           VALUES ($1,$2,'other',$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
          [ev.id, meet.id, ev.title, ev.eventName, ev.groupName ?? null, ev.isAllAround ?? false, i]
        );
        resultsInserted += await insertResults(client, ev.id, meet.id, ev.results);
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return NextResponse.json({ ok: true, meetsInserted, resultsInserted });
}

async function insertResults(
  client: import("pg").PoolClient,
  eventId: string,
  meetId: string,
  results: import("@/lib/weekly").WeeklyResult[]
): Promise<number> {
  let count = 0;
  for (const result of results) {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO weekly_results
        (event_id, meet_id, rank, player_name, player_slug, gender, age_group,
         level, grade, average, personal_best, pb_refreshed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        eventId,
        meetId,
        result.rank,
        result.playerName,
        result.playerSlug,
        result.gender,
        result.ageGroup ?? null,
        result.level,
        result.grade,
        result.average,
        result.personalBest,
        result.pbRefreshed ?? false
      ]
    );
    const resultId = rows[0].id;
    count++;

    for (let i = 0; i < result.attempts.length; i++) {
      const attempt = result.attempts[i];
      await client.query(
        "INSERT INTO weekly_attempts (result_id, seq, value) VALUES ($1,$2,$3)",
        [resultId, i, attempt === "DNF" ? null : attempt]
      );
    }
  }
  return count;
}
