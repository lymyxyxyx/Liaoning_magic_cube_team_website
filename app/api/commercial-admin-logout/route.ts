import { NextResponse } from "next/server";

export async function POST() {
  const response = new NextResponse(null, { status: 303, headers: { Location: "/commercial-teams" } });
  response.cookies.set("liaoning_commercial_admin_session", "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/"
  });
  return response;
}
