import { NextRequest, NextResponse } from "next/server";
import { canEditJudges } from "@/lib/judge-auth";
import { readJudges, writeJudges, type Judge } from "@/lib/judge-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const judges = await readJudges();
  return NextResponse.json({ judges });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as { judges?: Judge[]; editPassword?: string };
  if (!canEditJudges(payload.editPassword)) {
    return NextResponse.json({ message: "无法编辑。" }, { status: 401 });
  }

  if (!Array.isArray(payload.judges)) {
    return NextResponse.json({ message: "judges must be an array" }, { status: 400 });
  }

  try {
    const judges = await writeJudges(payload.judges);
    return NextResponse.json({ judges });
  } catch {
    return NextResponse.json({ message: "保存失败，请检查提交内容。" }, { status: 400 });
  }
}
