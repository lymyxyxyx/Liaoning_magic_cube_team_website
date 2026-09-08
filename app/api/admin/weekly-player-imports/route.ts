import { NextRequest, NextResponse } from "next/server";
import { createPlayerImportPreview, listPlayerImportBatches } from "@/lib/weekly-player-admin-store";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";

export const dynamic = "force-dynamic";
const maxUploadBytes = 3 * 1024 * 1024;

export async function GET(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  try {
    return NextResponse.json({ batches: await listPlayerImportBatches() });
  } catch (error) {
    console.error("admin weekly player imports list failed", error);
    return NextResponse.json({ message: "读取导入批次失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ message: "请上传 .xlsx 选手档案文件" }, { status: 400 });
  }
  if (file.size === 0 || file.size > maxUploadBytes) return NextResponse.json({ message: "Excel 文件必须小于 3 MB" }, { status: 400 });
  try {
    const result = await createPlayerImportPreview({ filename: file.name, buffer: Buffer.from(await file.arrayBuffer()), actor: "weekly-admin" });
    if (result.duplicate) {
      return NextResponse.json({ message: "该文件已经成功导入", duplicate: result.duplicate }, { status: 409 });
    }
    return NextResponse.json({ batch: result.batch }, { status: 201 });
  } catch (error) {
    console.error("admin weekly player import preview failed", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "解析选手 Excel 失败" }, { status: 400 });
  }
}
