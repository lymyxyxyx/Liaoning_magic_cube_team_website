import { readAppDocument, writeAppDocument } from "@/lib/app-document-store";
import {
  judgeGenders,
  judgeLevelTypes,
  judgeTrainingSessions,
  type Judge,
  type JudgeGender,
  type JudgeLevelType
} from "@/lib/judge-types";

const dataPath = `${process.cwd()}/data/judges.json`;
export type { Judge, JudgeGender, JudgeLevelType, JudgeTrainingSessionId } from "@/lib/judge-types";

type RawJudge = Partial<Judge> & {
  level?: string;
  nationalLevel?: string;
};

export async function readJudges(): Promise<Judge[]> {
  const raw = await readAppDocument<RawJudge>("judges", dataPath);
  return normalizeJudges(raw ?? []);
}

export async function writeJudges(judges: RawJudge[]) {
  const normalized = normalizeJudges(judges);
  await writeAppDocument("judges", dataPath, normalized);
  return normalized;
}

function normalizeJudges(judges: RawJudge[]) {
  if (!Array.isArray(judges)) return [];
  return judges
    .map((judge) => {
      const id = String(judge.id || "").trim() || createJudgeId();
      const name = String(judge.name || "").trim();
      if (!name) return null;
      const levelType = normalizeLevel(judge);
      const trainingSession = normalizeTrainingSession(judge);
      const gender = judgeGenders.includes(judge.gender as JudgeGender) ? (judge.gender as JudgeGender) : "男";
      const year = Number(judge.certifiedYear || 2025);
      const displayOrder = Number(judge.displayOrder);
      return {
        id,
        ...(String(judge.number || "").trim() ? { number: String(judge.number || "").trim() } : {}),
        name,
        gender,
        province: String(judge.province || "辽宁").trim() || "辽宁",
        city: String(judge.city || "沈阳").trim() || "沈阳",
        ...(Number.isFinite(displayOrder) ? { displayOrder } : {}),
        levelType,
        trainingSessionId: trainingSession.id,
        trainingLocation: trainingSession.location,
        trainingDate: trainingSession.trainingDate,
        ...(Number.isFinite(year) ? { certifiedYear: Math.max(1900, Math.min(2100, Math.trunc(year))) } : {}),
        createdAt: typeof judge.createdAt === "string" && judge.createdAt ? judge.createdAt : new Date().toISOString()
      };
    })
    .filter(Boolean) as Judge[];
}

function normalizeLevel(judge: RawJudge) {
  if (judgeLevelTypes.includes(judge.levelType as JudgeLevelType)) {
    if (judge.levelType === "国家级" && judge.nationalLevel === "一级") return "国家一级";
    if (judge.levelType === "国家级" && judge.nationalLevel === "二级") return "国家二级";
    if (judge.levelType === "国家级" && judge.nationalLevel === "三级") return "国家三级";
    return judge.levelType as JudgeLevelType;
  }

  if (judge.level === "国际级") return "国际级" as const;
  if (judge.level === "国家级") return "国家级" as const;
  if (judge.level === "国家一级") return "国家一级" as const;
  if (judge.level === "国家二级") return "国家二级" as const;
  if (judge.level === "国家三级") return "国家三级" as const;
  if (judge.level === "省一级") return "省一级" as const;
  if (judge.level === "省二级") return "省二级" as const;
  if (judge.level === "省三级") return "省三级" as const;
  if (judge.level === "省级") return "省一级" as const;
  if (judge.level === "市一级") return "市一级" as const;
  if (judge.level === "市二级") return "市二级" as const;
  if (judge.level === "市三级") return "市三级" as const;
  return "市一级" as const;
}

function normalizeTrainingSession(judge: RawJudge) {
  const session = judgeTrainingSessions.find((item) => item.id === judge.trainingSessionId);
  if (session) return session;

  const trainingLocation = String(judge.trainingLocation || "").trim();
  const trainingDate = String(judge.trainingDate || "").trim();
  if (trainingLocation || trainingDate) {
    return {
      id: String(judge.trainingSessionId || "manual").trim() || "manual",
      location: trainingLocation || judgeTrainingSessions[0].location,
      trainingDate
    };
  }

  return judgeTrainingSessions[0];
}

function createJudgeId() {
  return `judge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
