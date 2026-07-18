import { NextRequest, NextResponse } from "next/server";
import { listWeeklyMeetEventConfigs, updateWeeklyMeetConfig, type WeeklyMeetEventConfig } from "@/lib/weekly-entry-store";
import { hasWeeklyAdminSession } from "@/lib/weekly-admin-auth";
import { isWeeklySameOrigin } from "@/lib/weekly-request-security";
import { isBoundedString, isWeeklyDate } from "@/lib/weekly-request-validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
  const { id } = await params;
  try {
    return NextResponse.json({ eventConfigs: await listWeeklyMeetEventConfigs(id) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "读取周赛配置失败" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasWeeklyAdminSession(request))) return NextResponse.json({ message: "需要管理员登录" }, { status: 401 });
  if (!isWeeklySameOrigin(request)) return NextResponse.json({ message: "请求来源不受信任" }, { status: 403 });
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
    if (!isBoundedString(payload?.title, 200, true) || !isBoundedString(payload?.dateLabel, 100, true) ||
        !["draft", "open", "closed", "archived"].includes(payload?.status || "") ||
        !Array.isArray(payload?.eventConfigs) || payload.eventConfigs.length > 32 ||
        !payload.eventConfigs.every((config) => isBoundedString(config.eventId, 20, true) &&
          isBoundedString(config.format, 20, true) && typeof config.enabled === "boolean" &&
          Number.isInteger(config.seq) && config.seq >= 0 && config.seq <= 1000) ||
        (payload.startsAt !== undefined && payload.startsAt !== null && (typeof payload.startsAt !== "string" || !Number.isFinite(Date.parse(payload.startsAt)))) ||
        (payload.endsAt !== undefined && payload.endsAt !== null && (typeof payload.endsAt !== "string" || !Number.isFinite(Date.parse(payload.endsAt))))) {
      return NextResponse.json({ message: "周赛配置不完整" }, { status: 400 });
    }
    await updateWeeklyMeetConfig({
      id,
      title: payload.title,
      dateLabel: payload.dateLabel,
      status: payload.status as "draft" | "open" | "closed" | "archived",
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      eventConfigs: payload.eventConfigs
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存周赛配置失败" }, { status: 400 });
  }
}
