import { NextRequest, NextResponse } from "next/server";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { getWeeklyResultsTemplate } from "@/lib/weekly-results-import-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  try {
    const { id } = await params;
    const template = await getWeeklyResultsTemplate(id);
    return new NextResponse(new Uint8Array(template.buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${template.filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "生成成绩模板失败" }, { status: 400 });
  }
}
