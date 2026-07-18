import { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth";

export async function hasWeeklyAdminSession(request: NextRequest) {
  const token = request.cookies.get("liaoning_weekly_session")?.value;
  return Boolean(token && (await verifySessionToken(token)));
}
