import { weeklyPlayerPeople } from "@/lib/weekly";

export type PersonRole = "运动员" | "教练员" | "裁判员" | "组织者";
export type CompletionLevel = "低" | "中" | "高";
export type DataStatus = "待补充" | "部分整理" | "已整理";
export type RelationType = "参赛" | "执裁" | "教练" | "主办" | "工作人员" | "嘉宾" | "外出交流";
export type CompetitionCategoryId =
  | "shenyang-city-open"
  | "liaoning-province-open"
  | "national-chess-card"
  | "national-social-sports"
  | "wca-official";

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
  category: CompetitionCategoryId;
  date: string;
  province: string;
  city: string;
  venue: string;
  address: string;
  sponsor?: string;
  threeByThreeChampion?: string;
  tags: string[];
  cover: string;
  dataSource?: string;
  dataSourceUrl?: string;
  publicPlatform?: string;
  publicMethod?: string;
  externalUrl?: string;
  summary: string;
  description: string;
  status: DataStatus;
  completeness: CompletionLevel;
  featured: boolean;
};

export type CompetitionCategory = {
  id: CompetitionCategoryId;
  name: string;
  shortName: string;
  description: string;
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

export const competitionCategories: CompetitionCategory[] = [
  {
    id: "shenyang-city-open",
    name: "沈阳魔方公开赛（市赛）",
    shortName: "市赛",
    description: "以沈阳城市活动和本地选手交流为核心的公开赛事。"
  },
  {
    id: "liaoning-province-open",
    name: "辽宁省公开赛（省赛）",
    shortName: "省赛",
    description: "面向辽宁省内外选手的省级公开赛事和重点年度赛事。"
  },
  {
    id: "national-chess-card",
    name: "国家体育总局棋牌比赛",
    shortName: "国赛棋牌",
    description: "国家体育总局棋牌运动管理中心体系相关赛事。"
  },
  {
    id: "national-social-sports",
    name: "国家体育总局社体比赛",
    shortName: "国赛社体",
    description: "国家体育总局社会体育指导中心体系相关赛事。"
  },
  {
    id: "wca-official",
    name: "WCA",
    shortName: "WCA",
    description: "纳入 WCA 官方成绩系统的认证比赛。"
  }
];

export function getCompetitionCategory(categoryId: CompetitionCategoryId) {
  return competitionCategories.find((category) => category.id === categoryId);
}

const shenyangOpenCompetitions: Competition[] = Array.from({ length: 32 }, (_, index) => {
  const edition = 32 - index;
  const knownEditions: Record<
    number,
    Pick<Competition, "date" | "venue" | "address" | "publicPlatform" | "publicMethod" | "externalUrl"> &
      Partial<Pick<Competition, "name" | "sponsor" | "threeByThreeChampion" | "dataSource" | "dataSourceUrl">>
  > = {
    32: {
      date: "2026-04-26",
      venue: "沈河区青年大街123号嘉里城4楼",
      address: "辽宁省沈阳市沈河区青年大街123号嘉里城4楼",
      publicPlatform: "粗饼",
      publicMethod: "点击查看",
      externalUrl: "https://cubing.com/competition/Cubing-Shenyang-32nd-Open-2026"
    },
    31: {
      date: "2026-02-01",
      venue: "沈河区中街路115号盛京百货大家庭一楼",
      address: "辽宁省沈阳市沈河区中街路115号盛京百货大家庭一楼",
      publicPlatform: "粗饼",
      publicMethod: "点击查看",
      externalUrl: "https://cubing.com/competition/Cubing-Shenyang-The-31st-Open-2026"
    },
    29: {
      date: "2024-06-09",
      venue: "沈河区文化路81号万达广场（沈阳文化路店）一楼",
      address: "辽宁省沈阳市沈河区文化路81号万达广场（沈阳文化路店）一楼",
      sponsor: "GAN&中体",
      dataSource: "这里有好课小程序截图",
      publicPlatform: "这里有好课小程序",
      publicMethod: "截图记录"
    },
    25: {
      date: "2023-02-11",
      venue: "沈河区中街益田假日世界",
      address: "辽宁省沈阳市沈河区中街益田假日世界",
      dataSource: "微信公众号",
      dataSourceUrl: "https://mp.weixin.qq.com/s/7AljiWWiDZpQN0jrLaajMw",
      publicPlatform: "待补充",
      publicMethod: "后续整理"
    },
    28: {
      date: "2024-04-27",
      venue: "盛京百货大家庭",
      address: "辽宁省沈阳市盛京百货大家庭",
      threeByThreeChampion: "李昭昆",
      dataSource: "人工整理",
      publicPlatform: "待补充",
      publicMethod: "人工来源"
    },
    27: {
      date: "2023-09-23",
      venue: "中街益田假日世界",
      address: "辽宁省沈阳市沈河区中街益田假日世界",
      threeByThreeChampion: "韩业臻",
      dataSource: "人工整理",
      publicPlatform: "待补充",
      publicMethod: "人工来源"
    },
    26: {
      date: "2023-04-08",
      venue: "北一路万达",
      address: "辽宁省沈阳市北一路万达",
      threeByThreeChampion: "王艺衡",
      dataSource: "人工整理",
      publicPlatform: "待补充",
      publicMethod: "人工来源"
    },
    23: {
      date: "2022-01-01",
      venue: "沈北新区万达广场中庭（沈北店）",
      address: "辽宁省沈阳市沈北新区万达广场中庭（沈北店）",
      dataSource: "微信公众号",
      dataSourceUrl: "https://mp.weixin.qq.com/s/E7S9bzpr_JCca2l4DjQKHg",
      publicPlatform: "这里有好课小程序",
      publicMethod: "报名小程序"
    },
    22: {
      date: "2021-10-05",
      venue: "铁西区沈辽路万达广场",
      address: "辽宁省沈阳市铁西区沈辽路万达广场",
      dataSource: "微信公众号",
      dataSourceUrl: "https://mp.weixin.qq.com/s/9tA038yH0afEIRfXejNnIA",
      publicPlatform: "这里有好课小程序",
      publicMethod: "报名小程序"
    },
    21: {
      date: "2021-05-02",
      venue: "浑南区全运路万达广场",
      address: "辽宁省沈阳市浑南区全运路万达广场",
      dataSource: "微信公众号",
      dataSourceUrl: "https://mp.weixin.qq.com/s/K471Zq7JQpW5GG-tHmCxNg",
      publicPlatform: "这里有好课小程序",
      publicMethod: "报名小程序"
    },
    20: {
      date: "2021-04-05",
      venue: "铁西区沈辽路万达广场中庭",
      address: "辽宁省沈阳市铁西区沈辽路万达广场中庭",
      dataSource: "微信公众号",
      dataSourceUrl: "https://mp.weixin.qq.com/s/ddYcIhpc8lRSLiR9kVc4Hg",
      publicPlatform: "这里有好课小程序",
      publicMethod: "报名小程序"
    },
    16: {
      date: "2019-01-19",
      venue: "沈河区中街路115号兴隆大家庭一楼",
      address: "辽宁省沈阳市沈河区中街路115号兴隆大家庭一楼",
      sponsor: "裕鑫智胜",
      publicPlatform: "粗饼",
      publicMethod: "点击查看",
      externalUrl: "https://cubing.com/competition/Shenyang-Winter-2019"
    },
    15: {
      date: "2018-10-05",
      venue: "浑南万达",
      address: "辽宁省沈阳市浑南万达",
      dataSource: "人工整理",
      publicPlatform: "待补充",
      publicMethod: "人工来源"
    },
    14: {
      date: "2018-02-21",
      venue: "沈河区中街路115号兴隆大家庭一楼",
      address: "辽宁省沈阳市沈河区中街路115号兴隆大家庭一楼",
      sponsor: "裕鑫",
      publicPlatform: "粗饼",
      publicMethod: "点击查看",
      externalUrl: "https://cubing.com/competition/Shenyang-Spring-Festival-Open-2018"
    },
    12: {
      date: "2017-10-02",
      venue: "沈阳市奥体中心万达广场地下一层",
      address: "辽宁省沈阳市奥体中心万达广场地下一层",
      dataSource: "洋哥沈阳魔方公众号",
      publicPlatform: "粗饼",
      publicMethod: "点击查看",
      externalUrl: "https://cubing.com/competition/Shenyang-The-12th-Rubiks-Cube-Open-2017"
    },
    13: {
      date: "2018-01-27",
      venue: "中街豫珑城东区1F",
      address: "辽宁省沈阳市中街豫珑城东区1F",
      threeByThreeChampion: "孔维浩",
      dataSource: "人工整理",
      publicPlatform: "待补充",
      publicMethod: "人工来源"
    },
    11: {
      date: "2017-05-01",
      venue: "东陵区营盘西街17号奥体中心万达广场",
      address: "辽宁省沈阳市东陵区营盘西街17号奥体中心万达广场",
      publicPlatform: "粗饼",
      publicMethod: "点击查看",
      externalUrl: "https://cubing.com/competition/Shenyang-The-11th-Rubiks-Cube-Open-2017"
    },
    10: {
      date: "2016-10-16",
      venue: "和平区胜利南街74号南站公交客运站(近sk大厦)全视眼镜批发城4楼",
      address: "辽宁省沈阳市和平区胜利南街74号南站公交客运站(近sk大厦)全视眼镜批发城4楼",
      publicPlatform: "粗饼",
      publicMethod: "点击查看",
      externalUrl: "https://cubing.com/competition/Shenyang-The-10th-Rubiks-Cube-Open-2016"
    },
    9: {
      date: "2016-03-27",
      venue: "于洪区西江街160号中海城售楼处",
      address: "辽宁省沈阳市于洪区西江街160号中海城售楼处",
      dataSource: "洋哥沈阳魔方公众号",
      publicPlatform: "待补充",
      publicMethod: "人工来源"
    },
    6: {
      date: "2014-02-05",
      venue: "中街兴隆大家庭",
      address: "辽宁省沈阳市沈河区中街路115号兴隆大家庭",
      dataSource: "人工整理",
      publicPlatform: "待补充",
      publicMethod: "人工来源"
    },
    5: {
      date: "",
      venue: "中街兴隆大家庭",
      address: "辽宁省沈阳市沈河区中街路115号兴隆大家庭",
      threeByThreeChampion: "曹晟",
      dataSource: "人工整理",
      publicPlatform: "待补充",
      publicMethod: "人工来源"
    },
    4: {
      date: "",
      venue: "大东兴隆",
      address: "辽宁省沈阳市大东区大东兴隆（具体地点待补充）",
      dataSource: "人工整理",
      publicPlatform: "待补充",
      publicMethod: "人工来源"
    },
    3: {
      date: "",
      venue: "中街兴隆大家庭",
      address: "辽宁省沈阳市沈河区中街路115号兴隆大家庭",
      dataSource: "人工整理",
      publicPlatform: "待补充",
      publicMethod: "人工来源"
    },
    2: {
      date: "2011-07-22",
      venue: "中街兴隆大家庭",
      address: "辽宁省沈阳市沈河区中街路115号兴隆大家庭",
      threeByThreeChampion: "顾翔天",
      dataSource: "人工整理",
      publicPlatform: "待补充",
      publicMethod: "人工来源"
    },
    1: {
      date: "2011-12-04",
      venue: "中街兴隆大家庭",
      address: "辽宁省沈阳市沈河区中街路115号兴隆大家庭",
      threeByThreeChampion: "顾翔天",
      dataSource: "人工整理",
      publicPlatform: "待补充",
      publicMethod: "人工来源"
    }
  };
  const knownEdition = knownEditions[edition];

  return {
    id: `c-shenyang-open-${edition}`,
    slug: `shenyang-open-${edition}`,
    name: knownEdition?.name || `第${edition}届沈阳市魔方公开赛`,
    category: "shenyang-city-open",
    date: knownEdition?.date || "",
    province: "辽宁",
    city: "沈阳",
    venue: knownEdition?.venue || "待补充",
    address: knownEdition?.address || "辽宁省沈阳市（地点待补充）",
    sponsor: knownEdition?.sponsor,
    threeByThreeChampion: knownEdition?.threeByThreeChampion,
    tags: ["省内赛事", "公开赛", "沈阳市魔方公开赛"],
    cover: "/visuals/event-shenyang.svg",
    dataSource: knownEdition?.dataSource,
    dataSourceUrl: knownEdition?.dataSourceUrl,
    publicPlatform: knownEdition?.publicPlatform,
    publicMethod: knownEdition?.publicMethod,
    externalUrl: knownEdition?.externalUrl,
    summary: "沈阳市魔方公开赛历史赛事记录，日期和地点待后续补充。",
    description: "本条目用于沉淀沈阳市魔方公开赛历史资料，具体日期、地点、项目、成绩和相关人员可在后续继续补齐。",
    status: knownEdition ? "部分整理" : "待补充",
    completeness: knownEdition ? "中" : "低",
    featured: edition === 32
  };
});

const wcaLiaoningCompetitions: Competition[] = [
  {
    id: "c-wca-shenyang-2025-cookie-youth",
    slug: "wca-shenyang-2025-cookie-youth",
    name: "2025WCA粗饼最少步联赛",
    category: "wca-official",
    date: "2025-12-20",
    province: "辽宁",
    city: "沈阳",
    venue: "浑南区浑南中路28号优尔幼儿园",
    address: "辽宁省沈阳市浑南区浑南中路28号优尔幼儿园",
    tags: ["WCA", "最少步", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: true
  },
  {
    id: "c-wca-shenyang-autumn-2025",
    slug: "wca-shenyang-autumn-2025",
    name: "2025WCA沈阳秋季魔方赛",
    category: "wca-official",
    date: "2025-09-21",
    province: "辽宁",
    city: "沈阳",
    venue: "浑南区双园路20号甲中科实验学校体育馆",
    address: "辽宁省沈阳市浑南区双园路20号甲中科实验学校体育馆",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: true
  },
  {
    id: "c-wca-shenyang-spring-2025",
    slug: "wca-shenyang-spring-2025",
    name: "2025WCA沈阳春季魔方赛",
    category: "wca-official",
    date: "2025-04-13",
    province: "辽宁",
    city: "沈阳",
    venue: "和平区和平北大街99号爱尔眼科15层多功能剧场",
    address: "辽宁省沈阳市和平区和平北大街99号爱尔眼科15层多功能剧场",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-dalian-open-2024",
    slug: "wca-dalian-open-2024",
    name: "2024WCA大连魔方公开赛",
    category: "wca-official",
    date: "2024-09-16",
    province: "辽宁",
    city: "大连",
    venue: "中山区安民街11号大连铁路会议中心 大厅",
    address: "辽宁省大连市中山区安民街11号大连铁路会议中心大厅",
    tags: ["WCA", "大连"],
    cover: "/visuals/event-dalian.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-dandong-green-river-2024",
    slug: "wca-dandong-green-river-2024",
    name: "2024WCA丹东鸭绿江公开赛",
    category: "wca-official",
    date: "2024-06-29",
    province: "辽宁",
    city: "丹东",
    venue: "振兴区滨江中路158号福瑞德大酒店3楼钻石厅",
    address: "辽宁省丹东市振兴区滨江中路158号福瑞德大酒店3楼钻石厅",
    tags: ["WCA", "丹东"],
    cover: "/visuals/event-anshan.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-shenyang-spring-2024",
    slug: "wca-shenyang-spring-2024",
    name: "2024WCA沈阳春季赛",
    category: "wca-official",
    date: "2024-04-05",
    province: "辽宁",
    city: "沈阳",
    venue: "沈河区北站一路43号沈阳万豪酒店7楼大宴会厅",
    address: "辽宁省沈阳市沈河区北站一路43号沈阳万豪酒店7楼大宴会厅",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-fushun-open-2024",
    slug: "wca-fushun-open-2024",
    name: "2024WCA抚顺魔方公开赛",
    category: "wca-official",
    date: "2024-01-28",
    province: "辽宁",
    city: "抚顺",
    venue: "望花区顺富路81号抚顺佰宁宾馆三楼国际会议室",
    address: "辽宁省抚顺市望花区顺富路81号抚顺佰宁宾馆三楼国际会议室",
    tags: ["WCA", "抚顺"],
    cover: "/visuals/event-anshan.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-shenyang-open-2023",
    slug: "wca-shenyang-open-2023",
    name: "2023WCA沈阳公开赛",
    category: "wca-official",
    date: "2023-12-17",
    province: "辽宁",
    city: "沈阳",
    venue: "浑南新区白塔街全运二西路3号浑南白塔小学文化馆",
    address: "辽宁省沈阳市浑南新区白塔街全运二西路3号浑南白塔小学文化馆",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-fushun-open-2020",
    slug: "wca-fushun-open-2020",
    name: "2020WCA抚顺魔方公开赛",
    category: "wca-official",
    date: "待定",
    province: "待定",
    city: "待定",
    venue: "待定",
    address: "待定",
    tags: ["WCA"],
    cover: "/visuals/event-anshan.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "待补充",
    completeness: "低",
    featured: false
  },
  {
    id: "c-wca-neu-open-2019",
    slug: "wca-neu-open-2019",
    name: "2019WCA东北大学公开赛",
    category: "wca-official",
    date: "2019-12-15",
    province: "辽宁",
    city: "沈阳",
    venue: "和平区三好街96号同方广场大厦4楼爱因斯坦号房间",
    address: "辽宁省沈阳市和平区三好街96号同方广场大厦4楼爱因斯坦号房间",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-shenyang-open-2019",
    slug: "wca-shenyang-open-2019",
    name: "2019WCA沈阳公开赛",
    category: "wca-official",
    date: "2019-06-30",
    province: "辽宁",
    city: "沈阳",
    venue: "于洪区大通湖街168号玛丽蒂姆酒店大宴会厅",
    address: "辽宁省沈阳市于洪区大通湖街168号玛丽蒂姆酒店大宴会厅",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-dalian-spring-2019",
    slug: "wca-dalian-spring-2019",
    name: "2019WCA大连春季魔方赛",
    category: "wca-official",
    date: "2019-04-21",
    province: "辽宁",
    city: "大连",
    venue: "沙河口区黄河路600号长城饭店4楼多功能厅",
    address: "辽宁省大连市沙河口区黄河路600号长城饭店4楼多功能厅",
    tags: ["WCA", "大连"],
    cover: "/visuals/event-dalian.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-shenyang-new-year-2019",
    slug: "wca-shenyang-new-year-2019",
    name: "2019WCA沈阳新年赛",
    category: "wca-official",
    date: "2019-01-27",
    province: "辽宁",
    city: "沈阳",
    venue: "沈河区朝阳街238号 科隆酒店 3楼宴会厅",
    address: "辽宁省沈阳市沈河区朝阳街238号科隆酒店3楼宴会厅",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-shenyang-summer-2018",
    slug: "wca-shenyang-summer-2018",
    name: "2018WCA沈阳夏季魔方赛",
    category: "wca-official",
    date: "2018-08-05",
    province: "辽宁",
    city: "沈阳",
    venue: "和平区北五经街21号辽宁省青年宫大礼堂",
    address: "辽宁省沈阳市和平区北五经街21号辽宁省青年宫大礼堂",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-cross-strait-2018",
    slug: "wca-cross-strait-2018",
    name: "2018WCA两岸三地最少步赛",
    category: "wca-official",
    date: "2018-08-04",
    province: "辽宁",
    city: "沈阳",
    venue: "和平区十一纬路29号北方文化新谷3楼",
    address: "辽宁省沈阳市和平区十一纬路29号北方文化新谷3楼",
    tags: ["WCA", "最少步", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-shenyang-open-2018",
    slug: "wca-shenyang-open-2018",
    name: "2018WCA沈阳魔方公开赛",
    category: "wca-official",
    date: "2018-06-23~24",
    province: "辽宁",
    city: "沈阳",
    venue: "浑南新区白塔街全运二西路3号浑南白塔小学会议厅",
    address: "辽宁省沈阳市浑南新区白塔街全运二西路3号浑南白塔小学会议厅",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-dalian-open-2018",
    slug: "wca-dalian-open-2018",
    name: "2018WCA大连魔方公开赛",
    category: "wca-official",
    date: "2018-05-27",
    province: "辽宁",
    city: "大连",
    venue: "沙河口区黄河路600号长城饭店四楼会议室",
    address: "辽宁省大连市沙河口区黄河路600号长城饭店四楼会议室",
    tags: ["WCA", "大连"],
    cover: "/visuals/event-dalian.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-fushun-open-2018",
    slug: "wca-fushun-open-2018",
    name: "2018WCA抚顺魔方公开赛",
    category: "wca-official",
    date: "2018-01-28",
    province: "辽宁",
    city: "抚顺",
    venue: "新抚区西五路5号星期三宾馆(房产店) 七楼",
    address: "辽宁省抚顺市新抚区西五路5号星期三宾馆(房产店)七楼",
    tags: ["WCA", "抚顺"],
    cover: "/visuals/event-anshan.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-dalian-winter-2017",
    slug: "wca-dalian-winter-2017",
    name: "2017WCA大连冬季魔方赛",
    category: "wca-official",
    date: "2017-12-03",
    province: "辽宁",
    city: "大连",
    venue: "甘井子区高新街1号创业e港7楼",
    address: "辽宁省大连市甘井子区高新街1号创业e港7楼",
    tags: ["WCA", "大连"],
    cover: "/visuals/event-dalian.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-shenyang-spring-2017",
    slug: "wca-shenyang-spring-2017",
    name: "2017WCA沈阳春季魔方赛",
    category: "wca-official",
    date: "2017-05-13~14",
    province: "辽宁",
    city: "沈阳",
    venue: "沈河区十纬路44号二经二小学多功能厅",
    address: "辽宁省沈阳市沈河区十纬路44号二经二小学多功能厅",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-shenyang-winter-2016",
    slug: "wca-shenyang-winter-2016",
    name: "2016WCA沈阳冬季魔方赛",
    category: "wca-official",
    date: "2016-12-11",
    province: "辽宁",
    city: "沈阳",
    venue: "沈河区朝阳街168号星汇广场三楼布拉格",
    address: "辽宁省沈阳市沈河区朝阳街168号星汇广场三楼布拉格",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-asia-fmc-2016",
    slug: "wca-asia-fmc-2016",
    name: "2016WCA亚洲最少步联赛",
    category: "wca-official",
    date: "2016-12-10",
    province: "辽宁",
    city: "沈阳",
    venue: "和平区长白东路58号优尔教育",
    address: "辽宁省沈阳市和平区长白东路58号优尔教育",
    tags: ["WCA", "最少步", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-shenyang-open-2016",
    slug: "wca-shenyang-open-2016",
    name: "2016WCA沈阳魔方公开赛",
    category: "wca-official",
    date: "2016-04-23~24",
    province: "辽宁",
    city: "沈阳",
    venue: "和平区北五经街21号 辽宁省青年宫",
    address: "辽宁省沈阳市和平区北五经街21号辽宁省青年宫",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-dalian-open-2015",
    slug: "wca-dalian-open-2015",
    name: "2015WCA大连魔方公开赛",
    category: "wca-official",
    date: "2015-01-25",
    province: "辽宁",
    city: "大连",
    venue: "甘井子区虹韵路191号（甘井子区政府旁）大连市甘井子区实验小学",
    address: "辽宁省大连市甘井子区虹韵路191号（甘井子区政府旁）大连市甘井子区实验小学",
    tags: ["WCA", "大连"],
    cover: "/visuals/event-dalian.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-shenyang-open-2014",
    slug: "wca-shenyang-open-2014",
    name: "2014WCA沈阳魔方公开赛",
    category: "wca-official",
    date: "2014-12-14",
    province: "辽宁",
    city: "沈阳",
    venue: "沈阳11中音乐厅",
    address: "辽宁省沈阳市沈阳11中音乐厅",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-shenyang-open-2013",
    slug: "wca-shenyang-open-2013",
    name: "2013WCA沈阳公开赛",
    category: "wca-official",
    date: "2013-12-29",
    province: "辽宁",
    city: "沈阳",
    venue: "沈阳市第一中学教学楼二楼多媒体教室",
    address: "辽宁省沈阳市沈阳市第一中学教学楼二楼多媒体教室",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-dalian-open-2013",
    slug: "wca-dalian-open-2013",
    name: "2013WCA大连公开赛",
    category: "wca-official",
    date: "2013-10-27",
    province: "辽宁",
    city: "大连",
    venue: "大连工业大学综合楼A座1001",
    address: "辽宁省大连市大连工业大学综合楼A座1001",
    tags: ["WCA", "大连"],
    cover: "/visuals/event-dalian.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-yingkou-open-2013",
    slug: "wca-yingkou-open-2013",
    name: "2013WCA营口公开赛",
    category: "wca-official",
    date: "2013-07-14",
    province: "辽宁",
    city: "营口",
    venue: "站前区渤海东街32号营口第三中学多媒体会议室",
    address: "辽宁省营口市站前区渤海东街32号营口第三中学多媒体会议室",
    tags: ["WCA", "营口"],
    cover: "/visuals/event-anshan.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-china-fmc-shenyang-2011",
    slug: "wca-china-fmc-shenyang-2011",
    name: "2011WCA中国最少步赛沈阳站",
    category: "wca-official",
    date: "2011-11-06",
    province: "辽宁",
    city: "沈阳",
    venue: "大东区滂江街22号龙之梦购物中心3F优尔国际思维训练中心",
    address: "辽宁省沈阳市大东区滂江街22号龙之梦购物中心3F优尔国际思维训练中心",
    tags: ["WCA", "最少步", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-shenyang-open-2011",
    slug: "wca-shenyang-open-2011",
    name: "2011WCA沈阳公开赛",
    category: "wca-official",
    date: "2011-10-04",
    province: "辽宁",
    city: "沈阳",
    venue: "沈河区中街115号兴隆大家庭",
    address: "辽宁省沈阳市沈河区中街115号兴隆大家庭",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-yingkou-open-2011",
    slug: "wca-yingkou-open-2011",
    name: "2011WCA营口公开赛",
    category: "wca-official",
    date: "2011-06-19",
    province: "辽宁",
    city: "营口",
    venue: "站前区启文路102号营口平安保险",
    address: "辽宁省营口市站前区启文路102号营口平安保险",
    tags: ["WCA", "营口"],
    cover: "/visuals/event-anshan.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-shenyang-christmas-2010",
    slug: "wca-shenyang-christmas-2010",
    name: "2010WCA沈阳圣诞赛",
    category: "wca-official",
    date: "2010-12-26",
    province: "辽宁",
    city: "沈阳",
    venue: "沈河区北站路102号沈阳铁路大酒店",
    address: "辽宁省沈阳市沈河区北站路102号沈阳铁路大酒店",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  },
  {
    id: "c-wca-shenyang-open-2009",
    slug: "wca-shenyang-open-2009",
    name: "2009WCA沈阳公开赛",
    category: "wca-official",
    date: "2009-05-29",
    province: "辽宁",
    city: "沈阳",
    venue: "沈阳广播电视大学图书馆6楼",
    address: "辽宁省沈阳市沈阳广播电视大学图书馆6楼",
    tags: ["WCA", "沈阳"],
    cover: "/visuals/event-shenyang.svg",
    summary: "WCA 辽宁赛事记录。",
    description: "依据 WCA 辽宁赛事列表整理，后续可继续补充项目、成绩和相关人员。",
    status: "部分整理",
    completeness: "中",
    featured: false
  }
];

export const competitions: Competition[] = [
  ...wcaLiaoningCompetitions,
  ...shenyangOpenCompetitions,
  {
    id: "c-dalian-camp-2025",
    slug: "dalian-camp-2025",
    name: "辽宁魔方战队大连集训活动",
    category: "liaoning-province-open",
    date: "2025-02-22",
    province: "辽宁",
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
    category: "national-social-sports",
    date: "2025-06-01",
    province: "辽宁",
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
  { personId: "p-lin-hao", competitionId: "c-shenyang-open-32", type: "参赛", note: "三阶与二阶项目" },
  { personId: "p-lin-hao", competitionId: "c-liaoning-promotion-2025", type: "工作人员", note: "现场教学协助" },
  { personId: "p-zhao-yue", competitionId: "c-shenyang-open-32", type: "参赛", note: "金字塔项目" },
  { personId: "p-zhao-yue", competitionId: "c-dalian-camp-2025", type: "参赛", note: "赛前训练" },
  { personId: "p-chen-ming", competitionId: "c-dalian-camp-2025", type: "教练", note: "训练计划与规则讲解" },
  { personId: "p-chen-ming", competitionId: "c-shenyang-open-32", type: "主办", note: "赛事执行协调" },
  { personId: "p-wang-jing", competitionId: "c-shenyang-open-32", type: "执裁", note: "现场裁判" },
  { personId: "p-wang-jing", competitionId: "c-liaoning-promotion-2025", type: "嘉宾", note: "规则科普" }
];

export const achievements: Achievement[] = [
  {
    id: "a-lin-top",
    personId: "p-lin-hao",
    competitionId: "c-shenyang-open-32",
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
    competitionId: "c-shenyang-open-32",
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
