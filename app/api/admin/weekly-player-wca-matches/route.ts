import { NextRequest, NextResponse } from "next/server";
import {
  confirmWeeklyWcaMatch,
  listWeeklyWcaMatchCandidates,
  rejectWeeklyWcaMatch
} from "@/lib/weekly-player-library";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";
import { isBoundedString } from "@/lib/weekly-request-validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  try {
    const playerId = request.nextUrl.searchParams.get("playerId") || undefined;
    return NextResponse.json({ candidates: await listWeeklyWcaMatchCandidates(playerId) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "读取 WCA 匹配候选失败" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const payload = (await request.json().catch(() => null)) as {
    action?: "confirm" | "reject";
    weeklyPlayerId?: string;
    wcaId?: string;
  } | null;
  if ((payload?.action !== "confirm" && payload?.action !== "reject") ||
      !isBoundedString(payload?.weeklyPlayerId, 200, true) || !isBoundedString(payload?.wcaId, 20, true) ||
      !/^[A-Z0-9]{4,12}$/i.test(payload.wcaId)) {
    return NextResponse.json({ message: "匹配操作信息不完整" }, { status: 400 });
  }

  try {
    if (payload.action === "confirm") {
      const candidate = await confirmWeeklyWcaMatch({ weeklyPlayerId: payload.weeklyPlayerId, wcaId: payload.wcaId });
      return NextResponse.json({ candidate });
    }
    await rejectWeeklyWcaMatch({ weeklyPlayerId: payload.weeklyPlayerId, wcaId: payload.wcaId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存 WCA 匹配状态失败" }, { status: 400 });
  }
}
