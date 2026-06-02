import { NextRequest, NextResponse } from "next/server";
import { canEditJudges } from "@/lib/judge-auth";
import { createWeeklyPlayer } from "@/lib/weekly-entry-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as {
    name?: string;
    wcaId?: string;
    gender?: "男" | "女";
    province?: string;
    city?: string;
    birthDate?: string;
    editPassword?: string;
  } | null;

  try {
    if (!canEditJudges(payload?.editPassword)) return NextResponse.json({ message: "无法录入。" }, { status: 401 });
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
