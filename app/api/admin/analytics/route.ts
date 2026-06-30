import { NextResponse } from "next/server";
import { getAnalyticsSummary } from "@/lib/analytics-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const summary = await getAnalyticsSummary();
  return NextResponse.json({ summary });
}
