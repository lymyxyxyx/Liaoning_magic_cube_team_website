import { getPostgresPool } from "@/lib/postgres";
import type { WeeklyMeet, WeeklyEvent, WeeklyResult, WeeklyAttempt, Gender } from "@/lib/weekly";

type MeetRow = {
  id: string;
  slug: string;
  title: string;
  week_number: number;
  year: number;
  year_week: number;
  published_at: string | null;
  event: string;
  date_label: string;
  summary: string;
  pb_note: string;
  three_age_intro: string;
};

type EventRow = {
  id: string;
  meet_id: string;
  kind: string;
  title: string;
  event_name: string;
  group_name: string | null;
  is_all_around: boolean;
  seq: number;
};

type ResultRow = {
  id: number;
  event_id: string;
  meet_id: string;
  rank: number;
  player_name: string;
  player_slug: string;
  gender: string;
  age_group: string | null;
  level: string;
  grade: string;
  average: string;
  personal_best: string;
  pb_refreshed: boolean;
};

type AttemptRow = {
  result_id: number;
  seq: number;
  value: string | null;
};

export async function getWeeklyMeets(): Promise<WeeklyMeet[]> {
  const pool = getPostgresPool();
  const meetsResult = await pool.query<MeetRow>(
    "SELECT * FROM weekly_meets ORDER BY week_number DESC"
  );
  if (meetsResult.rows.length === 0) return [];

  const meetIds = meetsResult.rows.map((r) => r.id);
  const introsResult = await pool.query<{ meet_id: string; seq: number; text: string }>(
    "SELECT * FROM weekly_meet_intros WHERE meet_id = ANY($1) ORDER BY meet_id, seq",
    [meetIds]
  );
  const mainResultsResult = await pool.query<ResultRow>(
    `SELECT wr.* FROM weekly_results wr
     JOIN weekly_events we ON we.id = wr.event_id AND we.meet_id = wr.meet_id
     WHERE wr.meet_id = ANY($1) AND we.kind = 'main'
     ORDER BY wr.meet_id, wr.rank`,
    [meetIds]
  );

  const introsByMeet = groupBy(introsResult.rows, (r) => r.meet_id);
  const mainResultsByMeet = groupBy(mainResultsResult.rows, (r) => r.meet_id);
  const emptyAttempts = new Map<number, AttemptRow[]>();

  return meetsResult.rows.map((meetRow) => {
    const rawResults = mainResultsByMeet.get(meetRow.id) || [];
    return {
      id: meetRow.id,
      slug: meetRow.slug,
      title: meetRow.title,
      weekNumber: meetRow.week_number,
      year: meetRow.year,
      yearWeek: meetRow.year_week,
      publishedAt: meetRow.published_at ?? undefined,
      event: meetRow.event,
      dateLabel: meetRow.date_label,
      summary: meetRow.summary,
      pbNote: meetRow.pb_note,
      threeAgeIntro: meetRow.three_age_intro,
      intro: (introsByMeet.get(meetRow.id) || []).map((r) => r.text),
      results: rawResults.map((r) => buildResult(r, emptyAttempts)),
      threeAgeGroups: [],
      events: []
    };
  });
}

export async function getWeeklyMeetBySlug(slug: string): Promise<WeeklyMeet | null> {
  const pool = getPostgresPool();
  const meetResult = await pool.query<MeetRow>(
    "SELECT * FROM weekly_meets WHERE slug = $1",
    [slug]
  );
  if (meetResult.rows.length === 0) return null;
  const meetRow = meetResult.rows[0];

  const [introsResult, eventsResult, resultsResult] = await Promise.all([
    pool.query<{ meet_id: string; seq: number; text: string }>(
      "SELECT * FROM weekly_meet_intros WHERE meet_id = $1 ORDER BY seq",
      [meetRow.id]
    ),
    pool.query<EventRow>(
      "SELECT * FROM weekly_events WHERE meet_id = $1 ORDER BY kind, seq",
      [meetRow.id]
    ),
    pool.query<ResultRow>(
      "SELECT * FROM weekly_results WHERE meet_id = $1 ORDER BY event_id, rank",
      [meetRow.id]
    )
  ]);

  const resultIds = resultsResult.rows.map((r) => r.id);
  const attemptsResult =
    resultIds.length > 0
      ? await pool.query<AttemptRow>(
          "SELECT * FROM weekly_attempts WHERE result_id = ANY($1) ORDER BY result_id, seq",
          [resultIds]
        )
      : { rows: [] };

  const attemptsByResult = groupBy(attemptsResult.rows, (r) => r.result_id);
  const resultsByEvent = groupBy(resultsResult.rows, (r) => r.event_id);

  function buildEvent(row: EventRow): WeeklyEvent {
    const rawResults = resultsByEvent.get(row.id) || [];
    return {
      id: row.id,
      title: row.title,
      eventName: row.event_name,
      groupName: row.group_name ?? undefined,
      isAllAround: row.is_all_around,
      results: rawResults.map((r) => buildResult(r, attemptsByResult))
    };
  }

  const mainEvent = eventsResult.rows.find((e) => e.kind === "main");
  const ageGroupEvents = eventsResult.rows.filter((e) => e.kind === "age_group");
  const otherEvents = eventsResult.rows.filter((e) => e.kind === "other");

  return {
    id: meetRow.id,
    slug: meetRow.slug,
    title: meetRow.title,
    weekNumber: meetRow.week_number,
    year: meetRow.year,
    yearWeek: meetRow.year_week,
    publishedAt: meetRow.published_at ?? undefined,
    event: meetRow.event,
    dateLabel: meetRow.date_label,
    summary: meetRow.summary,
    pbNote: meetRow.pb_note,
    threeAgeIntro: meetRow.three_age_intro,
    intro: introsResult.rows.map((r) => r.text),
    results: mainEvent ? (resultsByEvent.get(mainEvent.id) || []).map((r) => buildResult(r, attemptsByResult)) : [],
    threeAgeGroups: ageGroupEvents.map(buildEvent),
    events: otherEvents.map(buildEvent)
  };
}

function buildResult(row: ResultRow, attemptsByResult: Map<number, AttemptRow[]>): WeeklyResult {
  const attempts: WeeklyAttempt[] = (attemptsByResult.get(row.id) || []).map((a) =>
    a.value === null ? "DNF" : Number(a.value)
  );
  return {
    rank: row.rank,
    playerName: row.player_name,
    playerSlug: row.player_slug,
    gender: row.gender as Gender,
    ageGroup: row.age_group ?? undefined,
    level: row.level,
    grade: row.grade,
    average: Number(row.average),
    personalBest: Number(row.personal_best),
    pbRefreshed: row.pb_refreshed,
    attempts
  };
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k) || [];
    arr.push(item);
    map.set(k, arr);
  }
  return map;
}
