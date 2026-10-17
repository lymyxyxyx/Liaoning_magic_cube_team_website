import { NextRequest, NextResponse } from "next/server";
import { createWeeklyPlayerLibraryEntry, findWeeklyPlayerLibraryEntry, listWeeklyPlayerLibrary, updateWeeklyPlayerLibraryEntry, WeeklyPlayerLibraryConflictError, type WeeklyPlayerLibraryEntry } from "@/lib/weekly-player-library";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const player = await findWeeklyPlayerLibraryEntry({ id });
      return player ? NextResponse.json({ player }) : NextResponse.json({ message: "周赛选手不存在" }, { status: 404 });
    }
    const players = await listWeeklyPlayerLibrary();
    return NextResponse.json({ players });
  } catch (error) {
    console.error("admin weekly player library list failed", error);
    return NextResponse.json({ message: "读取周赛选手库失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const payload = (await request.json().catch(() => null)) as { player?: Partial<WeeklyPlayerLibraryEntry> } | null;
  if (!payload?.player || typeof payload.player !== "object" || Array.isArray(payload.player)) return NextResponse.json({ message: "请逐条新建选手" }, { status: 400 });

  try {
    const player = await createWeeklyPlayerLibraryEntry(payload.player);
    return NextResponse.json({ player });
  } catch (error) {
    console.error("admin weekly player library save failed", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "新建选手失败" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const payload = (await request.json().catch(() => null)) as {
    id?: string;
    name?: string;
    expectedVersion?: string;
    patch?: Partial<WeeklyPlayerLibraryEntry>;
  } | null;
  if (!payload?.patch || (!payload.id && !payload.name)) return NextResponse.json({ message: "选手信息不完整" }, { status: 400 });
  if (!payload.expectedVersion) return NextResponse.json({ message: "请刷新选手资料后重试" }, { status: 428 });

  try {
    const player = await updateWeeklyPlayerLibraryEntry({ id: payload.id, name: payload.name, expectedVersion: payload.expectedVersion, patch: payload.patch });
    return NextResponse.json({ player });
  } catch (error) {
    if (!(error instanceof WeeklyPlayerLibraryConflictError)) console.error("admin weekly player library update failed", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存选手信息失败" }, { status: error instanceof WeeklyPlayerLibraryConflictError ? 409 : 400 });
  }
}
