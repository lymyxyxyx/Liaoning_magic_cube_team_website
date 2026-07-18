import { NextRequest, NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres";
import { weeklyPlayerPeople } from "@/lib/weekly-players";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";

const playerSlugByPlayerName = new Map(
  weeklyPlayerPeople.map((p) => [p.name, p.slug])
);

type WeeklyResultInput = {
  rank: number;
  playerName: string;
  gender: "男" | "女";
  ageGroup?: string;
  level?: string;
  grade?: string;
  average: number;
  personalBest: number;
  pbRefreshed?: boolean;
  attempts: (number | "DNF")[];
};

type EventInput = {
  eventName: string;
  kind?: "main" | "age_group" | "other";
  groupName?: string;
  isAllAround?: boolean;
  results: WeeklyResultInput[];
};

type WeeklyMeetInput = {
  weekNumber: number;
  year: number;
  yearWeek: number;
  publishedAt?: string;
  dateLabel: string;
  event: string;
  summary: string;
  intro?: string[];
  pbNote?: string;
  threeAgeIntro?: string;
  results: WeeklyResultInput[];
  events?: EventInput[];
};

export async function POST(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  return NextResponse.json({ message: "当前测试阶段仅维护第328周，暂未开放新周赛导入" }, { status: 403 });

  const payload = (await request.json().catch(() => null)) as WeeklyMeetInput | null;
  const validationError = validatePayload(payload);
  if (validationError) return NextResponse.json({ message: validationError }, { status: 400 });

  const meet = payload as WeeklyMeetInput;
  const id = `weekly-${meet.weekNumber}`;
  const slug = id;
  const title = `辽宁魔方线上周赛第${meet.weekNumber}周总结（${meet.year}年第${meet.yearWeek}周）`;
  const pool = getPostgresPool();
  const client = await pool.connect();

  const allEvents: EventInput[] = meet.events?.length
    ? meet.events!
    : [{ eventName: meet.event || "三阶", kind: "main", results: meet.results }];

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM weekly_meets WHERE id = $1 OR slug = $2", [id, slug]);
    await client.query(
      `INSERT INTO weekly_meets
        (id, slug, title, week_number, year, year_week, published_at, event, date_label, summary, pb_note, three_age_intro)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        slug,
        title,
        meet.weekNumber,
        meet.year,
        meet.yearWeek,
        meet.publishedAt || null,
        meet.event || "三阶",
        meet.dateLabel,
        meet.summary,
        meet.pbNote || "下表中个人 PB 部分标红的为本周刷新的成绩。",
        meet.threeAgeIntro || "三阶为周赛主要项目，后续可继续补充年龄组榜单。"
      ]
    );

    for (const [index, text] of (meet.intro || []).entries()) {
      if (!text.trim()) continue;
      await client.query("INSERT INTO weekly_meet_intros (meet_id, seq, text) VALUES ($1,$2,$3)", [id, index, text.trim()]);
    }

    let resultCount = 0;
    for (const [eventIndex, event] of allEvents.entries()) {
      const eventId = `${id}-event-${eventIndex}`;
      const kind = event.kind || (eventIndex === 0 ? "main" : "other");
      const eventTitle = `${event.eventName}比赛第${meet.yearWeek}周`;

      await client.query(
        `INSERT INTO weekly_events (id, meet_id, kind, title, event_name, group_name, is_all_around, seq)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [eventId, id, kind, eventTitle, event.eventName, event.groupName || null, Boolean(event.isAllAround), eventIndex]
      );

      for (const result of event.results) {
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO weekly_results
            (event_id, meet_id, rank, player_name, player_slug, gender, age_group, level, grade, average, personal_best, pb_refreshed)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           RETURNING id`,
          [
            eventId,
            id,
            result.rank,
            result.playerName,
            playerSlugByPlayerName.get(result.playerName) || "",
            result.gender,
            result.ageGroup || null,
            result.level || "",
            result.grade || "",
            result.average,
            result.personalBest,
            Boolean(result.pbRefreshed)
          ]
        );
        const resultId = inserted.rows[0].id;
        for (const [index, attempt] of result.attempts.slice(0, 5).entries()) {
          await client.query("INSERT INTO weekly_attempts (result_id, seq, value) VALUES ($1,$2,$3)", [
            resultId,
            index + 1,
            attempt === "DNF" ? null : attempt
          ]);
        }
        resultCount++;
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ slug, title, count: resultCount });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("weekly-admin save failed", error);
    return NextResponse.json({ message: "保存周赛失败" }, { status: 500 });
  } finally {
    client.release();
  }
}

function validatePayload(payload: WeeklyMeetInput | null) {
  if (!payload) return "Invalid payload";
  if (!Number.isInteger(payload.weekNumber) || payload.weekNumber <= 0) return "周次不正确";
  if (!Number.isInteger(payload.year) || payload.year < 2020) return "年份不正确";
  if (!Number.isInteger(payload.yearWeek) || payload.yearWeek <= 0) return "年度周次不正确";
  if (!payload.dateLabel?.trim()) return "请填写周赛周期";
  if (!payload.summary?.trim()) return "请填写摘要";
  if (payload.summary.length > 10_000 || (payload.intro?.length || 0) > 50) return "周赛文本内容过大";
  const allEvents = payload.events?.length
    ? payload.events
    : [{ eventName: payload.event || "三阶", results: payload.results }];

  let totalResults = 0;
  if (allEvents.length > 50) return "项目数量过多";
  for (const event of allEvents) {
    if (!event.eventName?.trim()) return "存在未填写项目名称的事件";
    if (!Array.isArray(event.results)) return `${event.eventName} 缺少成绩数据`;
    if (event.results.length > 5_000) return `${event.eventName} 成绩数量过多`;
    totalResults += event.results.length;
    for (const result of event.results) {
      if (!result.playerName?.trim()) return `${event.eventName} 中存在未填写姓名的成绩`;
      if (result.gender !== "男" && result.gender !== "女") return `${event.eventName} 中 ${result.playerName} 的性别不正确`;
      if (!Number.isFinite(result.average)) return `${event.eventName} 中 ${result.playerName} 的平均成绩不正确`;
      if (!Number.isFinite(result.personalBest)) return `${event.eventName} 中 ${result.playerName} 的个人 PB 不正确`;
      if (!Array.isArray(result.attempts) || result.attempts.length > 5) return `${event.eventName} 中 ${result.playerName} 的成绩次数不正确`;
    }
  }
  if (totalResults === 0) return "请至少录入一条成绩";
  return "";
}
