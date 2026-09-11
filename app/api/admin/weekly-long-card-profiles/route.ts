import { NextRequest, NextResponse } from "next/server";
import { createWeeklyLongCardProfile } from "@/lib/weekly-player-admin-store";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object" || typeof (payload as { name?: unknown }).name !== "string") {
    return NextResponse.json({ message: "选手姓名必填" }, { status: 400 });
  }
  try {
    return NextResponse.json({ profile: await createWeeklyLongCardProfile(payload) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "新建选手失败" }, { status: 400 });
  }
}
