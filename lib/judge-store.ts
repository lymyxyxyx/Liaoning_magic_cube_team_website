import { promises as fs } from "node:fs";
import { judgeLevels, type Judge, type JudgeLevel } from "@/lib/judge-types";

const dataPath = `${process.cwd()}/data/judges.json`;
export type { Judge, JudgeLevel } from "@/lib/judge-types";

export async function readJudges(): Promise<Judge[]> {
  try {
    const payload = await fs.readFile(dataPath, "utf-8");
    const parsed = JSON.parse(payload) as Partial<Judge>[];
    return normalizeJudges(parsed);
  } catch {
    return [];
  }
}

export async function writeJudges(judges: Partial<Judge>[]) {
  const normalized = normalizeJudges(judges);
  await fs.mkdir(`${process.cwd()}/data`, { recursive: true });
  await fs.writeFile(dataPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
  return normalized;
}

function normalizeJudges(judges: Partial<Judge>[]) {
  if (!Array.isArray(judges)) return [];
  return judges
    .map((judge) => {
      const id = String(judge.id || "").trim() || createJudgeId();
      const name = String(judge.name || "").trim();
      if (!name) return null;
      const level = judgeLevels.includes(judge.level as JudgeLevel) ? (judge.level as JudgeLevel) : "市级";
      const year = Number(judge.certifiedYear || 2025);
      return {
        id,
        name,
        province: String(judge.province || "辽宁").trim() || "辽宁",
        city: String(judge.city || "沈阳").trim() || "沈阳",
        level,
        certifiedYear: Number.isFinite(year) ? Math.max(1900, Math.min(2100, Math.trunc(year))) : 2025,
        createdAt: typeof judge.createdAt === "string" && judge.createdAt ? judge.createdAt : new Date().toISOString()
      };
    })
    .filter(Boolean) as Judge[];
}

function createJudgeId() {
  return `judge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
