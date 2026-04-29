import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const pool = getPostgresPool();
  const [events, countries] = await Promise.all([
    pool.query<{ id: string; name: string }>('SELECT id, name FROM wca_events ORDER BY rank::int, id'),
    pool.query<{ id: string; name: string }>("SELECT id, name FROM wca_countries ORDER BY name")
  ]);

  return NextResponse.json({ events: events.rows, countries: countries.rows });
}
