import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  void request;
  return new NextResponse(null, { status: 303, headers: { Location: "/weekly" } });
}
