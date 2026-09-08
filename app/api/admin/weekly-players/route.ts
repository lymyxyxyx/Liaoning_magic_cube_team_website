import { NextRequest, NextResponse } from "next/server";
import { createWeeklyPlayerProfile, listWeeklyPlayersForAdmin } from "@/lib/weekly-player-admin-store";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  const query = request.nextUrl.searchParams.get("q") || "";
  const status = request.nextUrl.searchParams.get("status") || "all";
  const gender = request.nextUrl.searchParams.get("gender") || "all";
  const page = Number(request.nextUrl.searchParams.get("page") || "1");
  try {
    return NextResponse.json(await listWeeklyPlayersForAdmin({
      query: query.slice(0, 100),
      status: status === "active" || status === "inactive" ? status : "all",
      gender: gender === "男" || gender === "女" || gender === "" ? gender : "all",
      page: Number.isFinite(page) ? page : 1
    }));
  } catch (error) {
    console.error("admin weekly players list failed", error);
    return NextResponse.json({ message: "读取周赛选手库失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object" || typeof (payload as { name?: unknown }).name !== "string") {
    return NextResponse.json({ message: "选手姓名必填" }, { status: 400 });
  }
  try {
    return NextResponse.json(await createWeeklyPlayerProfile(payload as Record<string, string | boolean>), { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "创建选手失败" }, { status: 400 });
  }
}
