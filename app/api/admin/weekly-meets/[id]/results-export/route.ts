import { NextRequest, NextResponse } from "next/server";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { getWeeklyResultsExport } from "@/lib/weekly-results-import-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  try {
    const { id } = await params;
    const exportFile = await getWeeklyResultsExport(id);
    return new NextResponse(new Uint8Array(exportFile.buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportFile.filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "导出周赛成绩失败" }, { status: 400 });
  }
}
