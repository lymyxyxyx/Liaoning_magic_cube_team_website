export const judgeGenders = ["男", "女"] as const;
export const judgeLevelTypes = ["国际级", "国家级", "国家一级", "国家二级", "国家三级", "省级", "市级"] as const;

export type JudgeGender = (typeof judgeGenders)[number];
export type JudgeLevelType = (typeof judgeLevelTypes)[number];

export type Judge = {
  id: string;
  number?: string;
  name: string;
  gender: JudgeGender;
  province: string;
  city: string;
  levelType: JudgeLevelType;
  certifiedYear: number;
  createdAt?: string;
};
