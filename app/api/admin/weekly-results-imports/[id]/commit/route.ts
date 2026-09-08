import { NextRequest, NextResponse } from "next/server";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";
import { commitWeeklyResultsImportBatch } from "@/lib/weekly-results-import-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const payload = await request.json().catch(() => null) as { meetId?: unknown } | null;
  const meetId = typeof payload?.meetId === "string" ? payload.meetId.trim() : "";
  if (!meetId) return NextResponse.json({ message: "缺少周赛 ID" }, { status: 400 });
  try {
    return NextResponse.json({ batch: await commitWeeklyResultsImportBatch({ id: (await params).id, meetId, actor: "weekly-admin" }) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "提交成绩导入失败" }, { status: 400 });
  }
}
