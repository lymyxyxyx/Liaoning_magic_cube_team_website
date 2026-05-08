import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { wcaMetadataCacheHeaders } from "@/lib/http-cache";
import { getPostgresPool } from "@/lib/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const pool = getPostgresPool();
  const [events, countries, lastExportDate] = await Promise.all([
    pool.query<{ id: string; name: string }>('SELECT id, name FROM wca_events ORDER BY rank::int, id'),
    pool.query<{ id: string; name: string }>("SELECT id, name FROM wca_countries ORDER BY name"),
    readLastExportDateFromPostgres()
  ]);

  return NextResponse.json(
    { events: events.rows, countries: countries.rows, lastExportDate },
    { headers: wcaMetadataCacheHeaders }
  );
}

async function readLastExportDateFromPostgres() {
  try {
    const result = await getPostgresPool().query<{ export_date: string }>(
      "SELECT export_date FROM wca_import_metadata WHERE id = 'current'"
    );
    if (result.rows[0]?.export_date) return result.rows[0].export_date;
  } catch {
    // The metadata table may not exist until the next WCA import or db:init run.
  }
  return readLastExportDateFromFile();
}

async function readLastExportDateFromFile() {
  const dataRoot = process.env.WCA_DATA_ROOT || (process.cwd() === "/app" ? "/app/data" : "/opt/ln-cubing/data");
  try {
    return (await fs.readFile(`${dataRoot}/wca_state/last_export_date.txt`, "utf-8")).trim();
  } catch {
    return "";
  }
}
