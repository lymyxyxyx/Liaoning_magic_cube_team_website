import { NextRequest, NextResponse } from "next/server";
import { deleteBigStackRecord, isBigStackEvent, updateBigStackRecord } from "@/lib/big-stack";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const { id } = await params;
  const payload = await request.json().catch(() => null) as { name?: string; eventId?: string; solveCount?: number; meetId?: string | null; sourceLabel?: string } | null;
  const eventId = payload?.eventId || "";
  const solveCount = payload?.solveCount;
  const meetId = payload?.meetId;
  const sourceLabel = payload?.sourceLabel;
  if (!payload || typeof payload.name !== "string" || !payload.name.trim() || !isBigStackEvent(eventId) ||
      typeof solveCount !== "number" || !Number.isInteger(solveCount) || solveCount < 0 ||
      !(typeof meetId === "string" || meetId === null) || typeof sourceLabel !== "string") {
    return NextResponse.json({ message: "大堆记录参数不正确" }, { status: 400 });
  }
  try {
    await updateBigStackRecord(id, { name: payload.name, eventId, solveCount, meetId, sourceLabel });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "更新大堆记录失败" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  try {
    await deleteBigStackRecord((await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "删除大堆记录失败" }, { status: 400 });
  }
}
