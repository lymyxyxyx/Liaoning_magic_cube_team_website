import { NextResponse } from "next/server";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { WCA_EVENTS } from "@/lib/wca-events";
import { isWeeklyCompetitionEnabled } from "@/lib/weekly-feature";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isWeeklyCompetitionEnabled()) return NextResponse.json({ message: "Not found" }, { status: 404 });
  try {
    const meets = (await listWeeklyMeetOptions()).filter((meet) => meet.status === "open");
    return NextResponse.json({ meets, events: WCA_EVENTS });
  } catch {
    return NextResponse.json({ message: "读取周赛失败" }, { status: 500 });
  }
}
