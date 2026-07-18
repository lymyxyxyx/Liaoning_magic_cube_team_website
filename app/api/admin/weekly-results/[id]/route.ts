import { NextRequest, NextResponse } from "next/server";
import { correctWeeklyResult, deleteWeeklyResult } from "@/lib/weekly-entry-store";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";
import { isBoundedString, isWeeklyAttempts, isWeeklyResultFormat } from "@/lib/weekly-request-validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as {
    attempts?: string[];
    format?: "avg5" | "best3" | "avg3" | "best1";
    reason?: string;
  } | null;

  try {
    const resultId = Number(id);
    if (!Number.isInteger(resultId) || resultId <= 0 || !isWeeklyResultFormat(payload?.format) ||
        !isWeeklyAttempts(payload?.attempts, payload?.format) ||
        (payload.reason !== undefined && !isBoundedString(payload.reason, 500))) {
      return NextResponse.json({ message: "缺少成绩修改信息" }, { status: 400 });
    }
    const calculated = await correctWeeklyResult({
      resultId,
      attempts: payload.attempts as string[],
      format: payload.format,
      reason: payload.reason || ""
    });
    return NextResponse.json({ calculated });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "修改成绩失败" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as { reason?: string } | null;

  try {
    const resultId = Number(id);
    if (!Number.isInteger(resultId) || resultId <= 0) {
      return NextResponse.json({ message: "成绩不存在" }, { status: 400 });
    }
    if (payload?.reason !== undefined && !isBoundedString(payload.reason, 500)) {
      return NextResponse.json({ message: "删除原因过长" }, { status: 400 });
    }
    await deleteWeeklyResult({ resultId, reason: payload?.reason || "" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "删除成绩失败" }, { status: 400 });
  }
}
