import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getPostgresPool().query("SELECT 1");
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch {
    return NextResponse.json({ status: "ok", db: "error" }, { status: 200 });
  }
}
