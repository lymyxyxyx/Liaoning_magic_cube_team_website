import { promises as fs } from "node:fs";
import {
  judgeGenders,
  judgeLevelTypes,
  judgeNationalLevels,
  type Judge,
  type JudgeGender,
  type JudgeLevelType,
  type JudgeNationalLevel
} from "@/lib/judge-types";

const dataPath = `${process.cwd()}/data/judges.json`;
export type { Judge, JudgeGender, JudgeLevelType, JudgeNationalLevel } from "@/lib/judge-types";

type RawJudge = Partial<Judge> & {
  level?: string;
};

export async function readJudges(): Promise<Judge[]> {
  try {
    const payload = await fs.readFile(dataPath, "utf-8");
    const parsed = JSON.parse(payload) as RawJudge[];
    return normalizeJudges(parsed);
  } catch {
    return [];
  }
}

export async function writeJudges(judges: RawJudge[]) {
  const normalized = normalizeJudges(judges);
  await fs.mkdir(`${process.cwd()}/data`, { recursive: true });
  await fs.writeFile(dataPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf-8");
  return normalized;
}

function normalizeJudges(judges: RawJudge[]) {
  if (!Array.isArray(judges)) return [];
  return judges
    .map((judge) => {
      const id = String(judge.id || "").trim() || createJudgeId();
      const name = String(judge.name || "").trim();
      if (!name) return null;
      const { levelType, nationalLevel } = normalizeLevel(judge);
      const gender = judgeGenders.includes(judge.gender as JudgeGender) ? (judge.gender as JudgeGender) : "男";
      const year = Number(judge.certifiedYear || 2025);
      return {
        id,
        name,
        gender,
        province: String(judge.province || "辽宁").trim() || "辽宁",
        city: String(judge.city || "沈阳").trim() || "沈阳",
        levelType,
        ...(levelType === "国家级" ? { nationalLevel } : {}),
        certifiedYear: Number.isFinite(year) ? Math.max(1900, Math.min(2100, Math.trunc(year))) : 2025,
        createdAt: typeof judge.createdAt === "string" && judge.createdAt ? judge.createdAt : new Date().toISOString()
      };
    })
    .filter(Boolean) as Judge[];
}

function normalizeLevel(judge: RawJudge) {
  if (judgeLevelTypes.includes(judge.levelType as JudgeLevelType)) {
    const levelType = judge.levelType as JudgeLevelType;
    const nationalLevel = judgeNationalLevels.includes(judge.nationalLevel as JudgeNationalLevel)
      ? (judge.nationalLevel as JudgeNationalLevel)
      : "一级";
    return { levelType, nationalLevel };
  }

  if (judge.level === "国家一级") return { levelType: "国家级" as const, nationalLevel: "一级" as const };
  if (judge.level === "国家二级") return { levelType: "国家级" as const, nationalLevel: "二级" as const };
  if (judge.level === "国家三级") return { levelType: "国家级" as const, nationalLevel: "三级" as const };
  if (judge.level === "省级") return { levelType: "省级" as const, nationalLevel: "一级" as const };
  return { levelType: "市级" as const, nationalLevel: "一级" as const };
}

function createJudgeId() {
  return `judge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
