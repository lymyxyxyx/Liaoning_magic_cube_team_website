import { NextRequest, NextResponse } from "next/server";
import { readAccountBook, writeAccountBook, type AccountEntry } from "@/lib/account-book-store";

export async function GET() {
  const payload = await readAccountBook();
  return NextResponse.json(payload);
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as { entries?: AccountEntry[]; action?: string };
  const saved = await writeAccountBook(payload.entries || [], payload.action);
  return NextResponse.json(saved);
}
