import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const target = request.nextUrl.clone();
  target.pathname = "/weekly";
  target.search = "";
  return NextResponse.redirect(target, { status: 303 });
}
