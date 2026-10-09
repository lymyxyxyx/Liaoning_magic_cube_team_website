import { NextRequest, NextResponse } from "next/server";
import {
  BigStackImportConflictError,
  commitBigStackImport,
  isBigStackEvent,
  previewBigStackImport,
  type BigStackImportMode
} from "@/lib/big-stack";
import { parseBigStackWorkbook } from "@/lib/big-stack-xlsx";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const action = String(formData.get("action") || "preview");
    const eventValue = String(formData.get("eventId") || "333");
    const modeValue = String(formData.get("mode") || "merge");
    if (!["preview", "commit"].includes(action) || !["baseline", "merge"].includes(modeValue)) return NextResponse.json({ message: "导入模式不正确" }, { status: 400 });
    const mode: BigStackImportMode = modeValue === "baseline" ? "baseline" : "merge";
    if (!isBigStackEvent(eventValue)) return NextResponse.json({ message: "项目不正确" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ message: "请选择 Excel 文件" }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".xlsx")) return NextResponse.json({ message: "只支持 .xlsx 文件" }, { status: 400 });
    if (action === "commit" && mode === "baseline" && formData.get("confirmBaseline") !== "true") {
      return NextResponse.json({ message: "全量替换需要再次确认" }, { status: 400 });
    }

    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ message: "Excel 文件不能超过 8MB" }, { status: 400 });
    const parsed = await parseBigStackWorkbook(Buffer.from(await file.arrayBuffer()));
    const input = { rows: parsed.rows, eventId: eventValue, mode, errors: parsed.errors, warnings: parsed.warnings };
    if (action !== "commit") return NextResponse.json({ preview: await previewBigStackImport(input) });
    if (parsed.errors.length > 0) return NextResponse.json({ message: parsed.errors[0], errors: parsed.errors }, { status: 400 });
    return NextResponse.json(await commitBigStackImport({ ...input, filename: file.name, expectedPreviewToken: String(formData.get("previewToken") || "") }));
  } catch (error) {
    console.error("big stack import failed", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "导入大堆记录失败" }, { status: error instanceof BigStackImportConflictError ? 409 : 400 });
  }
}
