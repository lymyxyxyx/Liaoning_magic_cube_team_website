import { NextRequest, NextResponse } from "next/server";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";

export async function POST(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  return NextResponse.json({ message: "旧版批量导入已关闭，请在周赛管理中按日期生成新周赛" }, { status: 403 });
}
