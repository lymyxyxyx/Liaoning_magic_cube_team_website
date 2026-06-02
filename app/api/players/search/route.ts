import { NextRequest, NextResponse } from "next/server";
import { searchWeeklyPlayers } from "@/lib/weekly-entry-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") || "";
    const players = await searchWeeklyPlayers(q);
    return NextResponse.json({ players });
  } catch {
    return NextResponse.json({ message: "搜索选手失败" }, { status: 500 });
  }
}
