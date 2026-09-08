import { NextRequest, NextResponse } from "next/server";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";
import { getWeeklyResultsImportBatch, resolveWeeklyResultsImportPlayers } from "@/lib/weekly-results-import-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  const meetId = request.nextUrl.searchParams.get("meetId") || "";
  try {
    const batch = await getWeeklyResultsImportBatch((await params).id, meetId);
    return batch ? NextResponse.json({ batch }) : NextResponse.json({ message: "导入批次不存在" }, { status: 404 });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "读取导入批次失败" }, { status: 400 }); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const payload = await request.json().catch(() => null) as { meetId?: string; resolutions?: Array<{ sourceRow?: unknown; playerId?: unknown }> } | null;
  if (!payload?.meetId || !Array.isArray(payload.resolutions)) return NextResponse.json({ message: "选手处理数据不正确" }, { status: 400 });
  const resolutions = payload.resolutions.filter((item) => Number.isInteger(item.sourceRow) && typeof item.playerId === "string" && item.playerId.trim()).map((item) => ({ sourceRow: Number(item.sourceRow), playerId: String(item.playerId).trim() }));
  try {
    const batch = await resolveWeeklyResultsImportPlayers({ batchId: (await params).id, meetId: payload.meetId, resolutions, actor: "weekly-admin" });
    return NextResponse.json({ batch });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "更新选手匹配失败" }, { status: 400 }); }
}
