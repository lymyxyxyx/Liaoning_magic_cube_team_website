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
    name?: string;
    gender?: "男" | "女" | "";
    city?: string;
    wcaId?: string;
    mainEvent?: string;
    bio?: string;
    specialties?: string[];
  } | null;

  if (!payload?.teamId || !payload?.memberId) {
    return NextResponse.json({ message: "参数不正确" }, { status: 400 });
  }

  const teams = await readCommercialTeams();
  const team = teams.find((t) => t.id === payload.teamId);
  if (!team) return NextResponse.json({ message: "找不到该战队" }, { status: 404 });

  const member = team.members.find((m) => m.id === payload.memberId);
  if (!member) return NextResponse.json({ message: "找不到该成员" }, { status: 404 });

  if (payload.name !== undefined) member.name = payload.name.trim() || member.name;
  if (payload.gender !== undefined) member.gender = payload.gender === "女" ? "女" : payload.gender === "男" ? "男" : undefined;
  if (payload.city !== undefined) member.city = payload.city.trim() || member.city;
  if (payload.wcaId !== undefined) member.wcaId = payload.wcaId.trim().toUpperCase() || undefined;
  if (payload.mainEvent !== undefined) member.mainEvent = payload.mainEvent.trim() || undefined;
  if (payload.bio !== undefined) member.bio = payload.bio;
  if (payload.specialties !== undefined) member.specialties = payload.specialties.map((s) => s.trim()).filter(Boolean);

  await writeCommercialTeams(teams);
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  if (!(await hasCommercialAdminSession(request))) {
    return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as {
    teamId?: string;
    name?: string;
    gender?: "男" | "女" | "";
    city?: string;
    wcaId?: string;
    mainEvent?: string;
    bio?: string;
    specialties?: string[];
  } | null;

  if (!payload?.teamId || !payload?.name?.trim()) {
    return NextResponse.json({ message: "战队和姓名必填" }, { status: 400 });
  }

  const teams = await readCommercialTeams();
  const team = teams.find((t) => t.id === payload.teamId);
  if (!team) return NextResponse.json({ message: "找不到该战队" }, { status: 404 });

  const slug = payload.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const id = `commercial-${slug}-${Date.now()}`;
  const newMember = {
    id,
    slug,
    name: payload.name.trim(),
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员" as const],
    city: (payload.city || "沈阳").trim() || "沈阳",
    gender: payload.gender === "女" ? "女" as const : payload.gender === "男" ? "男" as const : undefined,
    bio: payload.bio || "",
    visible: true,
    mainEvent: payload.mainEvent?.trim() || undefined,
    wcaId: payload.wcaId?.trim().toUpperCase() || undefined,
    specialties: payload.specialties?.map((s) => s.trim()).filter(Boolean)
  };

  team.members.push(newMember);
  await writeCommercialTeams(teams);
  return NextResponse.json({ ok: true, member: newMember });
}
