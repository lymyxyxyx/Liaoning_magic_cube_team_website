import { NextResponse } from "next/server";
import { listWeeklyMeetOptions } from "@/lib/weekly-entry-store";
import { WCA_EVENTS } from "@/lib/wca-events";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const meets = await listWeeklyMeetOptions();
    return NextResponse.json({ meets, events: WCA_EVENTS });
  } catch {
    return NextResponse.json({ message: "读取周赛失败" }, { status: 500 });
  }
}
