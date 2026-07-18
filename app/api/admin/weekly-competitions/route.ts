import { NextRequest, NextResponse } from "next/server";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  try {
    return NextResponse.json({ meets: await listWeeklyMeetOptions() });
  } catch {
    return NextResponse.json({ message: "读取周赛失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  return NextResponse.json({ message: "当前测试阶段仅维护第328周，暂未开放创建新周赛" }, { status: 403 });
}
