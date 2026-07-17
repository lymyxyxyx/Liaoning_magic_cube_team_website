import { NextRequest, NextResponse } from "next/server";
import { listWeeklyOperationLogs } from "@/lib/weekly-entry-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const meetId = request.nextUrl.searchParams.get("meetId") || "";
  const eventId = request.nextUrl.searchParams.get("eventId") || "333";
  const format = request.nextUrl.searchParams.get("format") || "avg5";
  if (!meetId) return NextResponse.json({ message: "缺少周赛" }, { status: 400 });

  try {
    return NextResponse.json({ logs: await listWeeklyOperationLogs(meetId, eventId, format) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "读取操作日志失败" }, { status: 400 });
  }
}
