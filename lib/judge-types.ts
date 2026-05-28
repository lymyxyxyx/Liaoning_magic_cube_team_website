export const judgeGenders = ["男", "女"] as const;
export const judgeLevelTypes = [
  "国际级",
  "国家级",
  "国家一级",
  "国家二级",
  "国家三级",
  "省一级",
  "省二级",
  "省三级",
  "市一级",
  "市二级",
  "市三级"
] as const;
export const judgeTrainingSessions = [
  { id: "training-wuhan-2025", location: "湖北武汉", trainingDate: "2025年8月20日至21日" },
  { id: "training-shantou-2025", location: "广东汕头", trainingDate: "2025年7月23日至24日" },
  { id: "training-pingyin-2025", location: "山东济南平阴", trainingDate: "2025年11月19日至20日" },
  { id: "training-fuping-2025", location: "陕西富平", trainingDate: "2025年10月15日至16日" },
  { id: "training-beijing-2025", location: "北京市东城区", trainingDate: "2025年12月30日至12月31日" }
] as const;

export type JudgeGender = (typeof judgeGenders)[number];
export type JudgeLevelType = (typeof judgeLevelTypes)[number];
export type JudgeTrainingSessionId = (typeof judgeTrainingSessions)[number]["id"];

export type Judge = {
  id: string;
  number?: string;
  displayOrder?: number;
  name: string;
  gender: JudgeGender;
  province: string;
  city: string;
  levelType: JudgeLevelType;
  trainingSessionId: JudgeTrainingSessionId | string;
  trainingLocation: string;
  trainingDate: string;
  certifiedYear?: number;
  createdAt?: string;
};
