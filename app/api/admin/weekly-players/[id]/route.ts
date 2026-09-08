import { NextRequest, NextResponse } from "next/server";
import { updateWeeklyPlayerProfile } from "@/lib/weekly-player-admin-store";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const { id } = await params;
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") return NextResponse.json({ message: "选手资料不正确" }, { status: 400 });
  try {
    return NextResponse.json({ player: await updateWeeklyPlayerProfile(id, payload) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存选手失败" }, { status: 400 });
  }
}
