import { NextRequest, NextResponse } from "next/server";
import { updateWeeklyLongCardProfile } from "@/lib/weekly-player-admin-store";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sourceRowNumber: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const { sourceRowNumber } = await params;
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") return NextResponse.json({ message: "长期卡资料不正确" }, { status: 400 });
  try {
    return NextResponse.json({ profile: await updateWeeklyLongCardProfile(Number(sourceRowNumber), payload) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存长期卡资料失败" }, { status: 400 });
  }
}
