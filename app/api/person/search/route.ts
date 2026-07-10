import { NextRequest, NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres";
import { readLocalProfiles } from "@/lib/local-profile-store";

export const dynamic = "force-dynamic";

type PersonRow = {
  wcaId: string;
  name: string;
  countryId: string;
  gender: string;
};

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ persons: [] });
  }

  try {
    const profiles = await readLocalProfiles();
    const wcaIds = profiles
      .filter((p) => p.wcaId && p.visible)
      .map((p) => p.wcaId as string);

    if (wcaIds.length === 0) {
      return NextResponse.json({ persons: [] });
    }

    const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

    const { rows } = await getPostgresPool().query<PersonRow>(
      `SELECT wca_id AS "wcaId", name, country_id AS "countryId", gender
       FROM wca_persons
       WHERE sub_id = '1'
         AND wca_id = ANY($1::text[])
         AND (name ILIKE $2 OR wca_id ILIKE $2)
       ORDER BY
         CASE WHEN wca_id ILIKE $3 THEN 0 ELSE 1 END,
         name
       LIMIT 20`,
      [wcaIds, like, q]
    );

    const profileMap = new Map(profiles.filter((p) => p.wcaId).map((p) => [p.wcaId as string, p]));

    const persons = rows.map((row) => ({
      ...row,
      province: profileMap.get(row.wcaId)?.province ?? null,
      city: profileMap.get(row.wcaId)?.city ?? null
    }));

    return NextResponse.json({ persons });
  } catch {
    return NextResponse.json({ persons: [] });
  }
}
