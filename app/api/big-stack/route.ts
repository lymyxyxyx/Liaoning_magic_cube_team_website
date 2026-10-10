import { decorateBigStackRecords } from "@/lib/big-stack-player-display";
import { NextRequest, NextResponse } from "next/server";
import {
  createBigStackRecord,
  isBigStackEvent,
  listBigStackRecords,
  publicBigStackRecord,
  listBigStackRevisions
} from "@/lib/big-stack";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isWeeklyCompetitionEnabled()) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (request.nextUrl.searchParams.get("history") === "1") {
    if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
    try {
      const revisions = await listBigStackRevisions({
        recordId: request.nextUrl.searchParams.get("recordId") || undefined,
        limit: Number(request.nextUrl.searchParams.get("limit") || 50)
      });
      return NextResponse.json({ revisions });
    } catch {
      return NextResponse.json({ message: "读取修改历史失败" }, { status: 500 });
    }
  }

  const event = request.nextUrl.searchParams.get("event") || "333";
  if (!isBigStackEvent(event)) return NextResponse.json({ message: "项目不正确" }, { status: 400 });
  try {
    const records = await decorateBigStackRecords(await listBigStackRecords(event));
    return NextResponse.json({ records: await hasWeeklyAdminSession(request) ? records : records.map(publicBigStackRecord) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ message: "读取大堆榜失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isWeeklyCompetitionEnabled()) return NextResponse.json({ message: "Not found" }, { status: 404 });
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const payload = await request.json().catch(() => null) as {
    name?: string;
    eventId?: string;
    solveCount?: number;
    playerId?: string;
    wcaId?: string;
    achievedAt?: string;
    meetId?: string | null;
    sourceLabel?: string;
    note?: string;
    reason?: string;
  } | null;
  const eventId = payload?.eventId || "";
  const solveCount = payload?.solveCount;
  if (!payload || typeof payload.name !== "string" || !payload.name.trim() || !isBigStackEvent(eventId) ||
      typeof solveCount !== "number" || !Number.isInteger(solveCount) || solveCount < 0) {
    return NextResponse.json({ message: "请填写姓名、项目和一小时还原数量" }, { status: 400 });
  }
  try {
    const record = await createBigStackRecord({ ...payload, name: payload.name, eventId, solveCount });
    return NextResponse.json({ record: (await decorateBigStackRecords([record]))[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存大堆记录失败" }, { status: 400 });
  }
}
