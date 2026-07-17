import { NextResponse } from "next/server";
import { listBigStackRecords, saveBigStackRecords, type BigStackRecord } from "@/lib/big-stack";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ records: await listBigStackRecords() });
  } catch {
    return NextResponse.json({ message: "读取大堆纪录失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { records?: BigStackRecord[] } | null;
  if (!Array.isArray(payload?.records)) return NextResponse.json({ message: "大堆纪录格式不正确" }, { status: 400 });
  try {
    return NextResponse.json({ records: await saveBigStackRecords(payload.records) });
  } catch {
    return NextResponse.json({ message: "保存大堆纪录失败" }, { status: 500 });
  }
}
