import { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth";

type WeeklyAdminCookieReader = {
  get(name: string): { value: string } | undefined;
};

export async function hasWeeklyAdminCookie(cookies: WeeklyAdminCookieReader) {
  const token = cookies.get("liaoning_weekly_admin_session")?.value;
  return Boolean(token && (await verifySessionToken(token, "weekly-admin")));
}

export async function hasWeeklyAdminSession(request: NextRequest) {
  return hasWeeklyAdminCookie(request.cookies);
}
