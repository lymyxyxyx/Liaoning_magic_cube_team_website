import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";

const execFileAsync = promisify(execFile);
const dbPath = `${process.cwd()}/data/wca_rankings.sqlite`;
const pageSize = 100;

function cleanId(value: string | null, fallback: string) {
  const next = value || fallback;
  return /^[A-Za-z0-9_ -]+$/.test(next) ? next : fallback;
}

function cleanMode(value: string | null) {
  return value === "average" ? "average" : "single";
}

function cleanGender(value: string | null) {
  return value === "m" || value === "f" ? value : "all";
}

function escapeSql(value: string) {
  return value.replaceAll("'", "''");
}

function formatCentiseconds(value: number) {
  const minutes = Math.floor(value / 6000);
  const centiseconds = value % 6000;
  const seconds = centiseconds / 100;
  if (minutes > 0) return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
  return seconds.toFixed(2).replace(/\.?0+$/, "");
}

function formatResult(eventId: string, value: number) {
  if (eventId === "333fm") return String(value);
  return formatCentiseconds(value);
}

type RawRankingRow = {
  rank: number;
  worldRank: number;
  wcaId: string;
  name: string;
  country: string;
  countryName: string;
  gender: string;
  best: number;
  competitionId: string | null;
  competitionName: string | null;
  date: string | null;
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const event = cleanId(params.get("event"), "333");
  const country = cleanId(params.get("country"), "China");
  const mode = cleanMode(params.get("mode"));
  const gender = cleanGender(params.get("gender"));
  const page = Math.max(1, Math.min(5000, Number(params.get("page") || 1) || 1));
  const offset = (page - 1) * pageSize;
  const genderWhere = gender === "all" ? "" : `AND p.gender = '${gender}'`;

  const sql = `
    SELECT
      r.country_rank AS rank,
      r.world_rank AS worldRank,
      r.person_id AS wcaId,
      p.name AS name,
      p.country_id AS country,
      COALESCE(cn.name, p.country_id) AS countryName,
      p.gender AS gender,
      r.best AS best,
      br.competition_id AS competitionId,
      COALESCE(c.name, br.competition_id, '') AS competitionName,
      COALESCE(c.date, '') AS date
    FROM ranks r
    JOIN persons p ON p.wca_id = r.person_id
    LEFT JOIN countries cn ON cn.id = p.country_id
    LEFT JOIN best_results br ON br.mode = r.mode AND br.person_id = r.person_id AND br.event_id = r.event_id
    LEFT JOIN competitions c ON c.id = br.competition_id
    WHERE r.mode = '${mode}'
      AND r.event_id = '${escapeSql(event)}'
      AND p.country_id = '${escapeSql(country)}'
      ${genderWhere}
    ORDER BY r.country_rank, r.world_rank, r.person_id
    LIMIT ${pageSize + 1} OFFSET ${offset}
  `;

  const { stdout } = await execFileAsync("sqlite3", ["-json", dbPath, sql], {
    maxBuffer: 1024 * 1024 * 8
  });
  const rawRows = stdout.trim() ? (JSON.parse(stdout) as RawRankingRow[]) : [];
  const rows = rawRows.slice(0, pageSize).map((row) => ({
    ...row,
    result: formatResult(event, row.best),
    competitionId: row.competitionId || "",
    competitionName: row.competitionName || "",
    date: row.date || ""
  }));

  return NextResponse.json({
    rows,
    page,
    pageSize,
    hasNextPage: rawRows.length > pageSize
  });
}
