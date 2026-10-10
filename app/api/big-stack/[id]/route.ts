import { decorateBigStackRecords } from "@/lib/big-stack-player-display";
import { editBigStackRecordDirectly } from "@/lib/big-stack-direct-edit";
import { WeeklyResultConflictError } from "@/lib/weekly-result-version";
import { isBoundedString } from "@/lib/weekly-request-validation";
import { NextRequest, NextResponse } from "next/server";
import { deleteBigStackRecord, isBigStackEvent, updateBigStackRecord } from "@/lib/big-stack";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const { id } = await params;
  const payload = await request.json().catch(() => null) as {
    weeklyNumber?: number | null;
    playerVersion?: string;
    genderOverride?: string;
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
    expectedVersion?: string;
  } | null;
  if (!isBoundedString(payload?.expectedVersion, 100, true)) return NextResponse.json({ message: "页面版本已过期，请刷新榜单" }, { status: 428 });
  const eventId = payload?.eventId || "";
  const solveCount = payload?.solveCount;
  if (!payload || typeof payload.name !== "string" || !payload.name.trim() || !isBigStackEvent(eventId) ||
      typeof solveCount !== "number" || !Number.isInteger(solveCount) || solveCount < 0) {
    return NextResponse.json({ message: "大堆记录参数不正确" }, { status: 400 });
  }
  try {
    const input = { ...payload, name: payload.name, eventId, solveCount, expectedVersion: payload.expectedVersion };
    const record = Object.hasOwn(payload, "weeklyNumber") ? await editBigStackRecordDirectly(id, input) : await updateBigStackRecord(id, input);
    return NextResponse.json({ record: (await decorateBigStackRecords([record]))[0] });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "更新大堆记录失败" }, { status: error instanceof WeeklyResultConflictError ? 409 : 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const payload = await request.json().catch(() => null) as { reason?: string; expectedVersion?: string } | null;
  try {
    if (!isBoundedString(payload?.expectedVersion, 100, true)) return NextResponse.json({ message: "页面版本已过期，请刷新榜单" }, { status: 428 });
    await deleteBigStackRecord((await params).id, payload?.reason || "", payload.expectedVersion);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "删除大堆记录失败" }, { status: error instanceof WeeklyResultConflictError ? 409 : 400 });
  }
}
