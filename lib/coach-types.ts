export const coachGenders = ["男", "女"] as const;
export const coachLevelTypes = ["国家级", "高级", "中级", "初级"] as const;

export type CoachGender = (typeof coachGenders)[number];
export type CoachLevelType = (typeof coachLevelTypes)[number];

export type Coach = {
  id: string;
  number?: string;
  name: string;
  gender: CoachGender;
  province: string;
  city: string;
  levelType: CoachLevelType;
  certifiedYear: number;
  createdAt?: string;
};
