import { NextRequest, NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres";

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

  const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

  try {
    const { rows } = await getPostgresPool().query<PersonRow>(
      `SELECT wca_id AS "wcaId", name, country_id AS "countryId", gender
       FROM wca_persons
       WHERE sub_id = '1'
         AND (name ILIKE $1 OR wca_id ILIKE $1)
       ORDER BY
         CASE WHEN wca_id ILIKE $2 THEN 0 ELSE 1 END,
         name
       LIMIT 20`,
      [like, q]
    );
    return NextResponse.json({ persons: rows });
  } catch {
    return NextResponse.json({ persons: [] });
  }
}
