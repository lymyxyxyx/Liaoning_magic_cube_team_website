import { NextRequest, NextResponse } from "next/server";
import { listWeeklyResults, saveWeeklyResult } from "@/lib/weekly-entry-store";
import { findWeeklyPlayerLibraryEntry } from "@/lib/weekly-player-library";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const eventId = request.nextUrl.searchParams.get("eventId") || "333";
  const format = request.nextUrl.searchParams.get("format") || "avg5";
  try {
    const results = await listWeeklyResults(params.id, eventId, format);
    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof Error && error.message === "项目不正确") {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ results: [] });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
    if (!payload?.eventId || !payload.player || !payload.attempts) {
      return NextResponse.json({ message: "缺少成绩录入信息" }, { status: 400 });
    }
    const libraryPlayer = await findWeeklyPlayerLibraryEntry({ id: payload.player.id, name: payload.player.name });
    if (!libraryPlayer) return NextResponse.json({ message: "请先从周赛选手库选择选手" }, { status: 400 });

    const calculated = await saveWeeklyResult({
      meetId: params.id,
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
      attempts: payload.attempts
    });
    const results = await listWeeklyResults(params.id, payload.eventId, payload.format || "avg5");
    return NextResponse.json({ calculated, results });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存成绩失败" }, { status: 400 });
  }
}
