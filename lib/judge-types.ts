export const judgeLevels = ["国家一级", "国家二级", "国家三级", "市级"] as const;

export type JudgeLevel = (typeof judgeLevels)[number];

export type Judge = {
  id: string;
  name: string;
  province: string;
  city: string;
  level: JudgeLevel;
  certifiedYear: number;
  createdAt?: string;
};
