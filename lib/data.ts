import { weeklyPlayerPeople } from "@/lib/weekly";

export type PersonRole = "运动员" | "教练员" | "裁判员" | "组织者";
export type CompletionLevel = "低" | "中" | "高";
export type DataStatus = "待补充" | "部分整理" | "已整理";
export type RelationType = "参赛" | "执裁" | "教练" | "主办" | "工作人员" | "嘉宾" | "外出交流";

export type Person = {
  id: string;
  slug: string;
  name: string;
  avatar: string;
  gender?: "男" | "女";
  roles: PersonRole[];
  city: string;
  mainEvent?: string;
  wcaId?: string;
  wcaUrl?: string;
  bio: string;
  specialties?: string[];
  rankingNote?: string;
  visible: boolean;
};

export type Competition = {
  id: string;
  slug: string;
  name: string;
  date: string;
  city: string;
  venue: string;
  address: string;
  tags: string[];
  cover: string;
  summary: string;
  description: string;
  status: DataStatus;
  completeness: CompletionLevel;
  featured: boolean;
};

export type PersonCompetition = {
  personId: string;
  competitionId: string;
  type: RelationType;
  note?: string;
};

export type Achievement = {
  id: string;
  personId: string;
  competitionId?: string;
  type: string;
  title: string;
  description: string;
  featured: boolean;
  year: string;
};

export const corePeople: Person[] = [
  {
    id: "p-lin-hao",
    slug: "lin-hao",
    name: "林皓",
    avatar: "/visuals/avatar-lin.svg",
    roles: ["运动员", "裁判员"],
    city: "沈阳",
    mainEvent: "三阶速拧",
    wcaId: "2023LINH01",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2023LINH01",
    bio: "辽宁魔方战队青年队员，长期参与省内赛事和公益推广活动，擅长三阶与二阶项目。",
    specialties: ["三阶", "二阶", "公开课助教"],
    rankingNote: "WCA 官方排名待同步",
    visible: true
  },
  {
    id: "p-zhao-yue",
    slug: "zhao-yue",
    name: "赵悦",
    avatar: "/visuals/avatar-zhao.svg",
    roles: ["运动员"],
    city: "大连",
    mainEvent: "金字塔",
    wcaId: "2022ZHAO02",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2022ZHAO02",
    bio: "专注异形项目训练，代表战队参加多场省内外赛事。",
    specialties: ["金字塔", "斜转", "少儿推广"],
    rankingNote: "省内公开赛多次进入决赛",
    visible: true
  },
  {
    id: "p-chen-ming",
    slug: "chen-ming",
    name: "陈铭",
    avatar: "/visuals/avatar-chen.svg",
    roles: ["教练员", "组织者"],
    city: "沈阳",
    mainEvent: "课程体系与赛事组织",
    bio: "辽宁魔方战队教练，负责入门训练体系、赛前集训和赛事执行协调。",
    specialties: ["三阶教学", "比赛规则培训", "赛事执行"],
    rankingNote: "战队培训负责人",
    visible: true
  },
  {
    id: "p-wang-jing",
    slug: "wang-jing",
    name: "王静",
    avatar: "/visuals/avatar-wang.svg",
    roles: ["裁判员"],
    city: "鞍山",
    mainEvent: "WCA 规则与现场执裁",
    bio: "长期参与省内魔方赛事执裁，关注比赛流程规范与新裁判培养。",
    specialties: ["现场执裁", "规则宣讲", "成绩录入"],
    rankingNote: "执裁经历待继续补充",
    visible: true
  }
];

export const people: Person[] = [...corePeople, ...weeklyPlayerPeople];

export const competitions: Competition[] = [
  {
    id: "c-shenyang-open-2024",
    slug: "shenyang-open-2024",
    name: "沈阳魔方公开赛 2024",
    date: "2024-08-18",
    city: "沈阳",
    venue: "沈阳全民健身中心",
    address: "辽宁省沈阳市和平区",
    tags: ["省内赛事", "公开赛", "WCA"],
    cover: "/visuals/event-shenyang.svg",
    summary: "面向东北地区选手的公开赛事，包含三阶、二阶、金字塔等常见项目。",
    description: "本赛事用于沉淀辽宁本地选手参赛资料、裁判执裁经历和战队组织活动记录。历史成绩与照片资料正在逐步整理。",
    status: "部分整理",
    completeness: "中",
    featured: true
  },
  {
    id: "c-dalian-camp-2025",
    slug: "dalian-camp-2025",
    name: "辽宁魔方战队大连集训活动",
    date: "2025-02-22",
    city: "大连",
    venue: "大连青少年活动中心",
    address: "辽宁省大连市沙河口区",
    tags: ["集训活动", "战队活动", "培训"],
    cover: "/visuals/event-dalian.svg",
    summary: "战队成员集中训练与赛前模拟，兼顾新队员规则培训。",
    description: "活动包含个人项目训练、模拟比赛、规则讲解和家长沟通环节。后续可补充训练照片、参与人员和阶段成果。",
    status: "待补充",
    completeness: "低",
    featured: true
  },
  {
    id: "c-liaoning-promotion-2025",
    slug: "liaoning-promotion-2025",
    name: "辽宁魔方公益推广日",
    date: "2025-06-01",
    city: "鞍山",
    venue: "市民文化广场",
    address: "辽宁省鞍山市铁东区",
    tags: ["推广活动", "公益", "非比赛"],
    cover: "/visuals/event-anshan.svg",
    summary: "面向公众的魔方体验、教学和展示活动。",
    description: "活动重点记录战队成员参与推广、教练员授课和裁判员规则科普情况。",
    status: "部分整理",
    completeness: "中",
    featured: false
  }
];

export const relations: PersonCompetition[] = [
  { personId: "p-lin-hao", competitionId: "c-shenyang-open-2024", type: "参赛", note: "三阶与二阶项目" },
  { personId: "p-lin-hao", competitionId: "c-liaoning-promotion-2025", type: "工作人员", note: "现场教学协助" },
  { personId: "p-zhao-yue", competitionId: "c-shenyang-open-2024", type: "参赛", note: "金字塔项目" },
  { personId: "p-zhao-yue", competitionId: "c-dalian-camp-2025", type: "参赛", note: "赛前训练" },
  { personId: "p-chen-ming", competitionId: "c-dalian-camp-2025", type: "教练", note: "训练计划与规则讲解" },
  { personId: "p-chen-ming", competitionId: "c-shenyang-open-2024", type: "主办", note: "赛事执行协调" },
  { personId: "p-wang-jing", competitionId: "c-shenyang-open-2024", type: "执裁", note: "现场裁判" },
  { personId: "p-wang-jing", competitionId: "c-liaoning-promotion-2025", type: "嘉宾", note: "规则科普" }
];

export const achievements: Achievement[] = [
  {
    id: "a-lin-top",
    personId: "p-lin-hao",
    competitionId: "c-shenyang-open-2024",
    type: "赛事冠军",
    title: "沈阳公开赛三阶项目优秀选手",
    description: "第一版先保留荣誉摘要，具体成绩等待官方资料补齐。",
    featured: true,
    year: "2024"
  },
  {
    id: "a-chen-coach",
    personId: "p-chen-ming",
    type: "优秀教练员",
    title: "辽宁魔方战队培训贡献",
    description: "持续负责战队课程、集训和赛事规则培训。",
    featured: true,
    year: "2025"
  },
  {
    id: "a-wang-judge",
    personId: "p-wang-jing",
    competitionId: "c-shenyang-open-2024",
    type: "优秀裁判员",
    title: "省内赛事执裁贡献",
    description: "参与现场执裁与新裁判规则讲解。",
    featured: false,
    year: "2024"
  }
];

export function getPeopleByRole(role: PersonRole) {
  return people.filter((person) => person.visible && person.roles.includes(role));
}

export function getPersonBySlug(slug: string) {
  return people.find((person) => person.slug === slug);
}

export function getCompetitionBySlug(slug: string) {
  return competitions.find((competition) => competition.slug === slug);
}

export function getPersonCompetitions(personId: string) {
  return relations
    .filter((relation) => relation.personId === personId)
    .map((relation) => ({
      ...relation,
      competition: competitions.find((competition) => competition.id === relation.competitionId)
    }))
    .filter((item) => item.competition);
}

export function getCompetitionPeople(competitionId: string) {
  return relations
    .filter((relation) => relation.competitionId === competitionId)
    .map((relation) => ({
      ...relation,
      person: people.find((person) => person.id === relation.personId)
    }))
    .filter((item) => item.person);
}

export function getAchievementsForPerson(personId: string) {
  return achievements.filter((achievement) => achievement.personId === personId);
}

export function getAchievementCompetition(achievement: Achievement) {
  return competitions.find((competition) => competition.id === achievement.competitionId);
}

export function getAchievementPerson(achievement: Achievement) {
  return people.find((person) => person.id === achievement.personId);
}
