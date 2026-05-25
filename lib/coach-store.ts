import { promises as fs } from "node:fs";
import { coachGenders, coachLevelTypes, type Coach, type CoachGender, type CoachLevelType } from "@/lib/coach-types";

const dataPath = `${process.cwd()}/data/coaches.json`;
export type { Coach, CoachGender, CoachLevelType } from "@/lib/coach-types";

type RawCoach = Partial<Coach> & {
  level?: string;
};

export async function readCoaches(): Promise<Coach[]> {
  try {
    const payload = await fs.readFile(dataPath, "utf-8");
    const parsed = JSON.parse(payload) as RawCoach[];
    return normalizeCoaches(parsed);
  } catch {
    return [];
  }
}

export async function writeCoaches(coaches: RawCoach[]) {
  const normalized = normalizeCoaches(coaches);
  await fs.mkdir(`${process.cwd()}/data`, { recursive: true });
  await fs.writeFile(dataPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
  return normalized;
}

function normalizeCoaches(coaches: RawCoach[]) {
  if (!Array.isArray(coaches)) return [];
  return coaches
    .map((coach) => {
      const id = String(coach.id || "").trim() || createCoachId();
      const name = String(coach.name || "").trim();
      if (!name) return null;
      const levelType = normalizeLevel(coach);
      const gender = coachGenders.includes(coach.gender as CoachGender) ? (coach.gender as CoachGender) : "男";
      const year = Number(coach.certifiedYear || 2025);
      return {
        id,
        ...(String(coach.number || "").trim() ? { number: String(coach.number || "").trim() } : {}),
        name,
        gender,
        province: String(coach.province || "辽宁").trim() || "辽宁",
        city: String(coach.city || "沈阳").trim() || "沈阳",
        levelType,
        certifiedYear: Number.isFinite(year) ? Math.max(1900, Math.min(2100, Math.trunc(year))) : 2025,
        createdAt: typeof coach.createdAt === "string" && coach.createdAt ? coach.createdAt : new Date().toISOString()
      };
    })
    .filter(Boolean) as Coach[];
}

function normalizeLevel(coach: RawCoach) {
  if (coachLevelTypes.includes(coach.levelType as CoachLevelType)) return coach.levelType as CoachLevelType;
  if (coach.level === "国家级") return "国家级" as const;
  if (coach.level === "高级") return "高级" as const;
  if (coach.level === "中级") return "中级" as const;
  return "初级" as const;
}

function createCoachId() {
  return `coach-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
