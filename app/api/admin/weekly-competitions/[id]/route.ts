import { NextRequest, NextResponse } from "next/server";
import { listWeeklyMeetEventConfigs, updateWeeklyMeetConfig, type WeeklyMeetEventConfig } from "@/lib/weekly-entry-store";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json({ eventConfigs: await listWeeklyMeetEventConfigs(id) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "读取周赛配置失败" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as {
    title?: string;
    dateLabel?: string;
    status?: "draft" | "open" | "closed" | "archived";
    startsAt?: string | null;
    endsAt?: string | null;
    eventConfigs?: WeeklyMeetEventConfig[];
  } | null;

  try {
    if (!payload?.title || !payload.dateLabel || !payload.status || !payload.eventConfigs) {
      return NextResponse.json({ message: "周赛配置不完整" }, { status: 400 });
    }
    await updateWeeklyMeetConfig({
      id,
      title: payload.title,
      dateLabel: payload.dateLabel,
      status: payload.status,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      eventConfigs: payload.eventConfigs
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存周赛配置失败" }, { status: 400 });
  }
}
