import { NextRequest, NextResponse } from "next/server";
import { getPlayerImportBatch } from "@/lib/weekly-player-admin-store";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  const { id } = await params;
  const batch = await getPlayerImportBatch(id);
  return batch ? NextResponse.json({ batch }) : NextResponse.json({ message: "导入批次不存在" }, { status: 404 });
}
