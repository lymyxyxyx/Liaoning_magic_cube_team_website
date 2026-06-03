import { NextRequest, NextResponse } from "next/server";
import { listWeeklyPlayerLibrary, saveWeeklyPlayerLibrary, type WeeklyPlayerLibraryEntry } from "@/lib/weekly-player-library";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const players = await listWeeklyPlayerLibrary();
    return NextResponse.json({ players });
  } catch (error) {
    console.error("admin weekly player library list failed", error);
    return NextResponse.json({ message: "读取周赛选手库失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as { players?: WeeklyPlayerLibraryEntry[] } | null;
  if (!Array.isArray(payload?.players)) return NextResponse.json({ message: "选手数据不正确" }, { status: 400 });

  try {
    const players = await saveWeeklyPlayerLibrary(payload.players);
    return NextResponse.json({ players });
  } catch (error) {
    console.error("admin weekly player library save failed", error);
    return NextResponse.json({ message: "保存周赛选手库失败" }, { status: 500 });
  }
}
