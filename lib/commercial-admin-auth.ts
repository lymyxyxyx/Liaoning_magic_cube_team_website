import { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth";

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

const COOKIE_NAME = "liaoning_commercial_admin_session";

export async function hasCommercialAdminCookie(cookies: CookieReader) {
  const token = cookies.get(COOKIE_NAME)?.value;
  return Boolean(token && (await verifySessionToken(token, "commercial-admin")));
}

export async function hasCommercialAdminSession(request: NextRequest) {
  return hasCommercialAdminCookie(request.cookies);
}
