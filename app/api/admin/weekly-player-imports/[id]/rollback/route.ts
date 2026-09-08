import { NextRequest, NextResponse } from "next/server";
import { rollbackPlayerImportBatch } from "@/lib/weekly-player-admin-store";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const { id } = await params;
  try {
    return NextResponse.json({ batch: await rollbackPlayerImportBatch({ id, actor: "weekly-admin" }) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "回滚导入失败" }, { status: 400 });
  }
}
