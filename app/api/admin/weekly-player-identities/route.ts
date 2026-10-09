import { NextRequest, NextResponse } from "next/server";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";
import { isBoundedString } from "@/lib/weekly-request-validation";
import { WeeklyResultConflictError } from "@/lib/weekly-result-version";
import { listWeeklyPlayerIdentities, updateWeeklyPlayerIdentity } from "@/lib/weekly-player-identity";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  try { return NextResponse.json({ players: await listWeeklyPlayerIdentities() }); }
  catch { return NextResponse.json({ message: "读取选手编号失败" }, { status: 500 }); }
}
export async function PATCH(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const input = await request.json().catch(() => null);
  if (!isBoundedString(input?.expectedVersion, 100, true)) return NextResponse.json({ message: "请刷新选手列表后再修改" }, { status: 428 });
  if (!isBoundedString(input?.id, 200, true)) return NextResponse.json({ message: "选手不存在" }, { status: 400 });
  try { return NextResponse.json({ player: await updateWeeklyPlayerIdentity(input) }); }
  catch (error) { return NextResponse.json({ message: error instanceof WeeklyResultConflictError ? "选手资料已被修改，请刷新后重试。你的修改尚未保存。" : error instanceof Error ? error.message : "保存失败" }, { status: error instanceof WeeklyResultConflictError ? 409 : 400 }); }
}
