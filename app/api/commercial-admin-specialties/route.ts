import { NextRequest, NextResponse } from "next/server";
import { hasCommercialAdminSession } from "@/lib/commercial-admin-auth";
import { readCommercialTeams, writeCommercialTeams } from "@/lib/commercial-team-store";

export async function PATCH(request: NextRequest) {
  if (!(await hasCommercialAdminSession(request))) {
    return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as {
    teamId?: string;
    memberId?: string;
    specialties?: string[];
  } | null;

  if (!payload?.teamId || !payload?.memberId || !Array.isArray(payload.specialties)) {
    return NextResponse.json({ message: "参数不正确" }, { status: 400 });
  }

  const teams = await readCommercialTeams();
  const team = teams.find((t) => t.id === payload.teamId);
  if (!team) return NextResponse.json({ message: "找不到该战队" }, { status: 404 });

  const member = team.members.find((m) => m.id === payload.memberId);
  if (!member) return NextResponse.json({ message: "找不到该成员" }, { status: 404 });

  member.specialties = payload.specialties.map((s) => s.trim()).filter(Boolean);
  await writeCommercialTeams(teams);

  return NextResponse.json({ ok: true, specialties: member.specialties });
}
