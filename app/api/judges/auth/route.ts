import { NextRequest, NextResponse } from "next/server";
import { canEditJudges } from "@/lib/judge-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as { password?: string };
  if (!canEditJudges(payload.password)) {
    return NextResponse.json({ message: "无法编辑。" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
