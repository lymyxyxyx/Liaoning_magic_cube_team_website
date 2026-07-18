import { NextRequest, NextResponse } from "next/server";
import { correctWeeklyResult, deleteWeeklyResult } from "@/lib/weekly-entry-store";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as {
    attempts?: string[];
    format?: "avg5" | "best3" | "avg3" | "best1";
    reason?: string;
  } | null;

  try {
    const resultId = Number(id);
    if (!Number.isInteger(resultId) || resultId <= 0 || !payload?.attempts || !payload.format) {
      return NextResponse.json({ message: "缺少成绩修改信息" }, { status: 400 });
    }
    const calculated = await correctWeeklyResult({
      resultId,
      attempts: payload.attempts,
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
  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as { reason?: string } | null;

  try {
    const resultId = Number(id);
    if (!Number.isInteger(resultId) || resultId <= 0) {
      return NextResponse.json({ message: "成绩不存在" }, { status: 400 });
    }
    await deleteWeeklyResult({ resultId, reason: payload?.reason || "" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "删除成绩失败" }, { status: 400 });
  }
}
