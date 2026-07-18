import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { createWeeklyPlayer } from "@/lib/weekly-entry-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("liaoning_weekly_session")?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ message: "请先登录周赛管理员账号" }, { status: 401 });
  }
  const payload = (await request.json().catch(() => null)) as {
    name?: string;
    wcaId?: string;
    gender?: "男" | "女";
    province?: string;
    city?: string;
    birthDate?: string;
  } | null;

  try {
    if (!payload?.name?.trim()) return NextResponse.json({ message: "请填写选手姓名" }, { status: 400 });
    const player = await createWeeklyPlayer({
      name: payload.name,
      wcaId: payload.wcaId,
      gender: payload.gender,
      province: payload.province,
      city: payload.city,
      birthDate: payload.birthDate
    });
    return NextResponse.json({ player });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "创建选手失败" }, { status: 400 });
  }
}
