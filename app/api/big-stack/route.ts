import { NextRequest, NextResponse } from "next/server";
import { createBigStackRecord, isBigStackEvent, listBigStackRecords } from "@/lib/big-stack";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const event = request.nextUrl.searchParams.get("event") || "333";
  if (!isBigStackEvent(event)) return NextResponse.json({ message: "项目不正确" }, { status: 400 });
  try {
    return NextResponse.json({ records: await listBigStackRecords(event) });
  } catch {
    return NextResponse.json({ message: "读取大堆榜失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const payload = await request.json().catch(() => null) as { name?: string; eventId?: string; solveCount?: number; meetId?: string } | null;
  const eventId = payload?.eventId || "";
  const solveCount = payload?.solveCount;
  const meetId = payload?.meetId;
  if (!payload || typeof payload.name !== "string" || !payload.name.trim() || !isBigStackEvent(eventId) ||
      typeof solveCount !== "number" || !Number.isInteger(solveCount) || solveCount < 0 || typeof meetId !== "string" || !meetId) {
    return NextResponse.json({ message: "请填写姓名、项目、还原数量和所属周赛" }, { status: 400 });
  }
  try {
    const id = await createBigStackRecord({ name: payload.name, eventId, solveCount, meetId });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存大堆记录失败" }, { status: 400 });
  }
}
