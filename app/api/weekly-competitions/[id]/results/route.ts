import { NextRequest, NextResponse } from "next/server";
import { getWeeklyMeetEntryAvailability, isWeeklyMeetPubliclyVisible, listWeeklyResults, saveWeeklyResult } from "@/lib/weekly-entry-store";
import { findWeeklyEligiblePlayer } from "@/lib/weekly-player-library";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";
import { verifySessionToken } from "@/lib/auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";
import { isBoundedString, isWeeklyAttempts, isWeeklyResultFormat } from "@/lib/weekly-request-validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isWeeklyCompetitionEnabled()) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (!(await isWeeklyMeetPubliclyVisible(id))) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const eventId = request.nextUrl.searchParams.get("eventId") || "333";
  const format = request.nextUrl.searchParams.get("format") || "avg5";
  try {
    const results = await listWeeklyResults(id, eventId, format);
    const token = request.cookies.get("liaoning_weekly_session")?.value;
    const isAdmin = Boolean(token && (await verifySessionToken(token)));
    const visibleResults = isAdmin
      ? results
      : results.map((result) => ({
          ...result,
          player: {
            ...result.player,
            // Scores remain public, but personal identifiers and exact birth
            // dates are only needed by the authenticated admin console.
            id: result.player.name,
            // Confirmed WCA matches are public; suggested/unconfirmed matches
            // stay hidden until an administrator approves them.
            wcaId: result.player.wcaIdConfirmed ? result.player.wcaId : "",
            wcaIdConfirmed: Boolean(result.player.wcaIdConfirmed),
            province: "",
            city: "",
            birthDate: ""
          }
        }));
    return NextResponse.json({ results: visibleResults });
  } catch (error) {
    if (error instanceof Error && error.message === "项目不正确") {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ results: [] });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isWeeklyCompetitionEnabled()) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const sessionToken = request.cookies.get("liaoning_weekly_session")?.value;
  if (!sessionToken || !(await verifySessionToken(sessionToken))) {
    return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  }
  const payload = (await request.json().catch(() => null)) as {
    eventId?: string;
    player?: {
      id: string;
      name: string;
      slug: string;
      wcaId: string;
      gender: "男" | "女";
      province: string;
      city: string;
      birthDate: string;
      ageGroup?: string;
      ageGroupIsFuzzy?: boolean;
    };
    attempts?: string[];
    format?: "avg5" | "best3" | "avg3" | "best1";
  } | null;

  try {
    if (!isBoundedString(payload?.eventId, 20, true) || !payload.player ||
        !isWeeklyResultFormat(payload.format) || !isWeeklyAttempts(payload.attempts, payload.format) ||
        !isBoundedString(payload.player.id, 200, true) || !isBoundedString(payload.player.name, 100, true)) {
      return NextResponse.json({ message: "缺少成绩录入信息" }, { status: 400 });
    }
    const availability = await getWeeklyMeetEntryAvailability(id);
    if (!availability.canEnter) return NextResponse.json({ message: availability.message }, { status: 403 });
    const libraryPlayer = await findWeeklyEligiblePlayer({ id: payload.player.id, name: payload.player.name });
    if (!libraryPlayer) return NextResponse.json({ message: "请先从周赛选手库选择选手" }, { status: 400 });

    const calculated = await saveWeeklyResult({
      meetId: id,
      eventId: payload.eventId,
      format: payload.format || "avg5",
      player: {
        id: libraryPlayer.id,
        name: libraryPlayer.name,
        slug: "",
        wcaId: libraryPlayer.wcaId || "",
        gender: libraryPlayer.gender === "女" ? "女" : "男",
        province: libraryPlayer.province,
        city: libraryPlayer.city,
        birthDate: libraryPlayer.birthDate,
        ageGroup: libraryPlayer.ageGroup || "",
        ageGroupIsFuzzy: Boolean(libraryPlayer.ageGroupIsFuzzy)
      },
      attempts: payload.attempts as string[]
    });
    const results = await listWeeklyResults(id, payload.eventId, payload.format || "avg5");
    return NextResponse.json({ calculated, results });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存成绩失败" }, { status: 400 });
  }
}
