import { NextResponse } from "next/server";
import { readCoaches, writeCoaches, type Coach } from "@/lib/coach-store";

export async function GET() {
  const coaches = await readCoaches();
  return NextResponse.json({ coaches });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { coaches?: Coach[] };
  if (!Array.isArray(payload.coaches)) {
    return NextResponse.json({ message: "coaches must be an array" }, { status: 400 });
  }

  try {
    const coaches = await writeCoaches(payload.coaches);
    return NextResponse.json({ coaches });
  } catch {
    return NextResponse.json({ message: "failed to save coaches" }, { status: 500 });
  }
}
