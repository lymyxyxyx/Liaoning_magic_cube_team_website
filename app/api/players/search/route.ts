import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { searchWeeklyPlayers } from "@/lib/weekly-entry-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("liaoning_weekly_session")?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ message: "请先登录周赛管理员账号" }, { status: 401 });
  }
  try {
    const q = request.nextUrl.searchParams.get("q") || "";
    const players = await searchWeeklyPlayers(q);
    return NextResponse.json({ players });
  } catch {
    return NextResponse.json({ message: "搜索选手失败" }, { status: 500 });
  }
}
