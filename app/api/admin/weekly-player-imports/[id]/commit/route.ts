import { NextRequest, NextResponse } from "next/server";
import { commitPlayerImportBatch, type WeeklyImportResolution } from "@/lib/weekly-player-admin-store";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const { id } = await params;
  const payload = await request.json().catch(() => null) as { resolutions?: WeeklyImportResolution[] } | null;
  if (payload?.resolutions !== undefined && !Array.isArray(payload.resolutions)) return NextResponse.json({ message: "冲突处理数据不正确" }, { status: 400 });
  try {
    return NextResponse.json({ batch: await commitPlayerImportBatch({ id, resolutions: payload?.resolutions || [], actor: "weekly-admin" }) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "提交导入失败" }, { status: 400 });
  }
}
