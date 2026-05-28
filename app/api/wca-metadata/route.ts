import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { wcaMetadataCacheHeaders } from "@/lib/http-cache";
import { getPostgresPool } from "@/lib/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const pool = getPostgresPool();
  const [events, countries, lastExportDate] = await Promise.all([
    pool.query<{ id: string; name: string }>('SELECT id, name FROM wca_events ORDER BY rank::int, id'),
    pool.query<{ id: string; name: string; continentId: string; iso2: string | null }>(
      'SELECT id, name, continent_id AS "continentId", iso2 FROM wca_countries ORDER BY name'
    ),
    readLastExportDateFromPostgres()
  ]);

  const zhDisplay = new Intl.DisplayNames(["zh-CN"], { type: "region" });
  const fallbackZh: Record<string, string> = {
    China: "中国",
    "Hong Kong": "中国香港",
    Macau: "中国澳门",
    "Chinese Taipei": "中国台北",
    "United States": "美国",
    "United Kingdom": "英国",
    "South Korea": "韩国",
    "North Korea": "朝鲜"
  };
  const countriesWithZh = countries.rows.map((country) => {
    const normalizedIso2 = country.iso2?.trim().toUpperCase();
    const inferredZh =
      normalizedIso2 && /^[A-Z]{2}$/.test(normalizedIso2) ? zhDisplay.of(normalizedIso2) || "" : "";
    return {
      id: country.id,
      name: country.name,
      continentId: country.continentId,
      nameZh: fallbackZh[country.id] || inferredZh || country.name
    };
  });

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
      countriesWithZh
        .filter((country) => country.continentId && continentNameMap[country.continentId])
        .map((country) => [country.continentId, { id: country.continentId, name: country.continentId, nameZh: continentNameMap[country.continentId] }])
    ).values()
  );

  return NextResponse.json(
    { events: events.rows, countries: countriesWithZh, continents, lastExportDate },
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
