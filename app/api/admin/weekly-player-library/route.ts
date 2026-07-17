import { NextRequest, NextResponse } from "next/server";
import { listWeeklyPlayerLibrary, saveWeeklyPlayerLibrary, updateWeeklyPlayerLibraryEntry, type WeeklyPlayerLibraryEntry } from "@/lib/weekly-player-library";

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

export async function PATCH(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as {
    id?: string;
    name?: string;
    patch?: Partial<WeeklyPlayerLibraryEntry>;
  } | null;
  if (!payload?.patch || (!payload.id && !payload.name)) return NextResponse.json({ message: "选手信息不完整" }, { status: 400 });

  try {
    const player = await updateWeeklyPlayerLibraryEntry({ id: payload.id, name: payload.name, patch: payload.patch });
    return NextResponse.json({ player });
  } catch (error) {
    console.error("admin weekly player library update failed", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存选手信息失败" }, { status: 400 });
  }
}
