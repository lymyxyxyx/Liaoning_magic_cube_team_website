import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);
const dbPath = `${process.cwd()}/data/wca_rankings.sqlite`;

async function queryJson<T>(sql: string): Promise<T[]> {
  const { stdout } = await execFileAsync("sqlite3", ["-json", dbPath, sql], {
    maxBuffer: 1024 * 1024 * 8
  });
  return stdout.trim() ? (JSON.parse(stdout) as T[]) : [];
}

export async function GET() {
  const [events, countries] = await Promise.all([
    queryJson<{ id: string; name: string }>("SELECT id, name FROM events ORDER BY rank, id"),
    queryJson<{ id: string; name: string }>("SELECT id, name FROM countries ORDER BY name")
  ]);

  return NextResponse.json({ events, countries });
}
