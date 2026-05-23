import { NextRequest, NextResponse } from "next/server";
import { readCommercialTeams, writeCommercialTeams, type EditableCommercialTeam } from "@/lib/commercial-team-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const teams = await readCommercialTeams();
  return NextResponse.json({ teams });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as { teams?: EditableCommercialTeam[] };
  if (!Array.isArray(payload.teams)) {
    return NextResponse.json({ message: "teams must be an array" }, { status: 400 });
  }

  try {
    const teams = await writeCommercialTeams(payload.teams);
    return NextResponse.json({ teams });
  } catch {
    return NextResponse.json({ message: "保存失败，请检查提交内容。" }, { status: 400 });
  }
}
