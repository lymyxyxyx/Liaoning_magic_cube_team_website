import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { readJudges, writeJudges, type Judge } from "@/lib/judge-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const judges = await readJudges();
  return NextResponse.json({ judges });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("liaoning_judge_session")?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json({ message: "无法编辑。" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as { judges?: Judge[] } | null;

  if (!payload || !Array.isArray(payload.judges)) {
    return NextResponse.json({ message: "judges must be an array" }, { status: 400 });
  }

  try {
    const judges = await writeJudges(payload.judges);
    return NextResponse.json({ judges });
  } catch {
    return NextResponse.json({ message: "保存失败，请检查提交内容。" }, { status: 400 });
  }
}
