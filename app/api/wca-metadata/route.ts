import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { wcaMetadataCacheHeaders } from "@/lib/http-cache";
import { getPostgresPool } from "@/lib/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const pool = getPostgresPool();
  const [events, countries, lastExportDate] = await Promise.all([
    pool.query<{ id: string; name: string }>('SELECT id, name FROM wca_events ORDER BY rank::int, id'),
    pool.query<{ id: string; name: string; continentId: string; nameZh: string }>(
      'SELECT id, name, "continentId", CASE id ' +
        "WHEN 'China' THEN '中国' " +
        "WHEN 'Hong Kong' THEN '中国香港' " +
        "WHEN 'Macau' THEN '中国澳门' " +
        "WHEN 'Chinese Taipei' THEN '中国台北' " +
        "WHEN 'United States' THEN '美国' " +
        "WHEN 'Japan' THEN '日本' " +
        "WHEN 'South Korea' THEN '韩国' " +
        "WHEN 'Singapore' THEN '新加坡' " +
        "WHEN 'Malaysia' THEN '马来西亚' " +
        "WHEN 'Thailand' THEN '泰国' " +
        "WHEN 'Indonesia' THEN '印度尼西亚' " +
        "WHEN 'Philippines' THEN '菲律宾' " +
        "WHEN 'Vietnam' THEN '越南' " +
        "WHEN 'Australia' THEN '澳大利亚' " +
        "WHEN 'Canada' THEN '加拿大' " +
        "WHEN 'United Kingdom' THEN '英国' " +
        "WHEN 'France' THEN '法国' " +
        "WHEN 'Germany' THEN '德国' " +
        "WHEN 'Italy' THEN '意大利' " +
        "WHEN 'Spain' THEN '西班牙' " +
        "WHEN 'Poland' THEN '波兰' " +
        "WHEN 'Russia' THEN '俄罗斯' " +
        "WHEN 'India' THEN '印度' " +
        "WHEN 'Brazil' THEN '巴西' " +
        "WHEN 'Mexico' THEN '墨西哥' " +
        "WHEN 'South Africa' THEN '南非' " +
        'ELSE name END AS "nameZh" FROM wca_countries ORDER BY name'
    ),
    readLastExportDateFromPostgres()
  ]);

  const continentNameMap: Record<string, string> = {
    "_Africa": "非洲",
    "_Asia": "亚洲",
    "_Europe": "欧洲",
    "_North America": "北美洲",
    "_Oceania": "大洋洲",
    "_South America": "南美洲"
  };
  const continents = Array.from(
    new Map(
      countries.rows
        .filter((country) => country.continentId && continentNameMap[country.continentId])
        .map((country) => [country.continentId, { id: country.continentId, name: country.continentId, nameZh: continentNameMap[country.continentId] }])
    ).values()
  );

  return NextResponse.json(
    { events: events.rows, countries: countries.rows, continents, lastExportDate },
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
