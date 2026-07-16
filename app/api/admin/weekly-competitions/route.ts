import { NextResponse } from "next/server";
import { createWeeklyMeet, listWeeklyMeetOptions } from "@/lib/weekly-entry-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ meets: await listWeeklyMeetOptions() });
  } catch {
    return NextResponse.json({ message: "读取周赛失败" }, { status: 500 });
  }
}

export async function POST() {
  try {
    return NextResponse.json({ meet: await createWeeklyMeet() }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "新建周赛失败" }, { status: 400 });
  }
}
