import { NextRequest, NextResponse } from "next/server";
import { createWeeklyMeet, listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";
import { isBoundedString, isWeeklyDate } from "@/lib/weekly-request-validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  try {
    return NextResponse.json({ meets: await listWeeklyMeetOptions() });
  } catch {
    return NextResponse.json({ message: "读取周赛失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const payload = (await request.json().catch(() => null)) as {
    startDate?: string;
    endDate?: string;
    templateMeetId?: string | null;
    status?: "draft" | "open";
  } | null;
  if (!isWeeklyDate(payload?.startDate) || !isWeeklyDate(payload?.endDate) ||
      (payload.templateMeetId !== undefined && payload.templateMeetId !== null && !isBoundedString(payload.templateMeetId, 160)) ||
      (payload.status !== undefined && payload.status !== "draft" && payload.status !== "open")) {
    return NextResponse.json({ message: "周赛参数不正确" }, { status: 400 });
  }

  try {
    const meet = await createWeeklyMeet({
      startDate: payload.startDate,
      endDate: payload.endDate,
      templateMeetId: payload.templateMeetId,
      status: payload.status
    });
    return NextResponse.json({ meet }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "创建周赛失败" }, { status: 400 });
  }
}
