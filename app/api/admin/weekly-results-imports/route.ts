import { NextRequest, NextResponse } from "next/server";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";
import { createWeeklyResultsImportPreview } from "@/lib/weekly-results-import-store";

export const dynamic = "force-dynamic";
const maxUploadBytes = 3 * 1024 * 1024;

export async function POST(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const meetId = String(form?.get("meetId") || "").trim();
  const source = String(form?.get("source") || "xlsx");
  if (!meetId) return NextResponse.json({ message: "缺少周赛 ID" }, { status: 400 });
  try {
    if (source === "paste") {
      const paste = String(form?.get("paste") || "");
      const pasteEventCode = String(form?.get("eventCode") || "");
      const batch = await createWeeklyResultsImportPreview({ meetId, filename: "bulk-paste.txt", paste, pasteEventCode, actor: "weekly-admin" });
      return NextResponse.json({ batch }, { status: 201 });
    }
    const file = form?.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ message: "请上传标准 .xlsx 成绩模板" }, { status: 400 });
    if (file.size === 0 || file.size > maxUploadBytes) return NextResponse.json({ message: "Excel 文件必须小于 3 MB" }, { status: 400 });
    const batch = await createWeeklyResultsImportPreview({ meetId, filename: file.name, buffer: Buffer.from(await file.arrayBuffer()), actor: "weekly-admin" });
    return NextResponse.json({ batch }, { status: 201 });
  } catch (error) {
    console.error("admin weekly results import preview failed", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "解析成绩导入失败" }, { status: 400 });
  }
}
