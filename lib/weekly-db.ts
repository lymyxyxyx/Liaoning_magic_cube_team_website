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
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  is_public: boolean;
  data_version: number;
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
  event_code: string | null;
  enabled: boolean;
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
  value_centiseconds: number | null;
  status: string;
};

export async function getWeeklyMeets(): Promise<WeeklyMeet[]> {
  try {
    const pool = getPostgresPool();
    const meetsResult = await pool.query<MeetRow>(
      "SELECT * FROM weekly_meets WHERE is_public = TRUE ORDER BY week_number DESC"
    );
    const visibleMeetRows = meetsResult.rows;
    if (visibleMeetRows.length === 0) return [];

    const meetIds = visibleMeetRows.map((r) => r.id);
    const introsResult = await pool.query<{ meet_id: string; seq: number; text: string }>(
      "SELECT * FROM weekly_meet_intros WHERE meet_id = ANY($1) ORDER BY meet_id, seq",
      [meetIds]
    );
    const mainResultsResult = await pool.query<ResultRow>(
      `SELECT wr.* FROM weekly_results wr
     JOIN weekly_events we ON we.id = wr.event_id AND we.meet_id = wr.meet_id
     WHERE wr.meet_id = ANY($1) AND we.event_code = '333' AND we.enabled = TRUE
     ORDER BY wr.meet_id, wr.rank`,
      [meetIds]
    );

    const introsByMeet = groupBy(introsResult.rows, (r) => r.meet_id);
    const mainResultsByMeet = groupBy(mainResultsResult.rows, (r) => r.meet_id);
    const emptyAttempts = new Map<number, AttemptRow[]>();

    return visibleMeetRows.map((meetRow) => {
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
  } catch (error) {
    console.error("[weekly-db] getWeeklyMeets: database query failed", error);
    throw new Error("周赛数据库暂时不可用", { cause: error });
  }
}

export async function getWeeklyMeetBySlug(
  slug: string,
  options: { includePrivate?: boolean } = {},
): Promise<WeeklyMeet | null> {
  try {
    const pool = getPostgresPool();
    const meetResult = await pool.query<MeetRow>(
      "SELECT * FROM weekly_meets WHERE slug = $1 AND (is_public = TRUE OR $2::boolean = TRUE)",
      [slug, options.includePrivate === true]
    );
    if (meetResult.rows.length === 0) return null;
    const meetRow = meetResult.rows[0];

  const [introsResult, eventsResult, resultsResult] = await Promise.all([
    pool.query<{ meet_id: string; seq: number; text: string }>(
      "SELECT * FROM weekly_meet_intros WHERE meet_id = $1 ORDER BY seq",
      [meetRow.id]
    ),
    pool.query<EventRow>(
      "SELECT * FROM weekly_events WHERE meet_id = $1 AND enabled = TRUE ORDER BY seq, event_code, id",
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
      eventCode: row.event_code ?? undefined,
      title: row.title,
      eventName: row.event_name,
      groupName: row.group_name ?? undefined,
      isAllAround: row.is_all_around,
      results: rawResults.map((r) => buildResult(r, attemptsByResult))
    };
  }

  // v2 uses weekly_events.event_code as the presentation model. `kind` is
  // legacy metadata and must not manufacture an empty 333 main event.
  const mainEvent = eventsResult.rows.find((e) => e.event_code === "333");
  const otherEvents = eventsResult.rows.filter((e) => e.event_code !== "333");

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
    threeAgeGroups: [],
    events: otherEvents.map(buildEvent)
    };
  } catch (error) {
    console.error("[weekly-db] getWeeklyMeetBySlug: database query failed", error);
    throw new Error("周赛数据库暂时不可用", { cause: error });
  }
}

function buildResult(row: ResultRow, attemptsByResult: Map<number, AttemptRow[]>): WeeklyResult {
  const attempts: WeeklyAttempt[] = (attemptsByResult.get(row.id) || []).map(readAttemptValue);
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

function readAttemptValue(attempt: AttemptRow): WeeklyAttempt {
  if (attempt.status === "ok" && Number.isInteger(attempt.value_centiseconds)) {
    return Number(attempt.value_centiseconds) / 100;
  }
  if (attempt.status === "dns") return "DNS";
  if (attempt.status === "dnf") return "DNF";
  const legacyValue = attempt.value === null ? -1 : Number(attempt.value);
  return legacyValue < 0 ? "DNF" : legacyValue;
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
