export const judgeGenders = ["男", "女"] as const;
export const judgeLevelTypes = ["国家级", "省级", "市级"] as const;
export const judgeNationalLevels = ["一级", "二级", "三级"] as const;

export type JudgeGender = (typeof judgeGenders)[number];
export type JudgeLevelType = (typeof judgeLevelTypes)[number];
export type JudgeNationalLevel = (typeof judgeNationalLevels)[number];

export type Judge = {
  id: string;
  name: string;
  gender: JudgeGender;
  province: string;
  city: string;
  levelType: JudgeLevelType;
  nationalLevel?: JudgeNationalLevel;
  certifiedYear: number;
  createdAt?: string;
};
