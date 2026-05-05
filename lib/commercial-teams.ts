import { Person } from "@/lib/data";

export type CommercialTeam = {
  id: string;
  name: string;
  sponsor?: string;
  brandUrl?: string;
  description?: string;
  members: Person[];
};

export const commercialTeamMembers: Person[] = [
  // GAN战队
  {
    id: "ct-han-ye-zhen",
    slug: "han-ye-zhen",
    name: "韩业臻",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "三阶速拧亚洲级选手，个人三阶平均最佳 5.57s、单次最佳 4.61s，多次在 WCA 赛事中夺冠，曾创亚洲纪录。GAN战队核心成员。",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2017HANY01",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2017HANY01"
  },
  {
    id: "ct-li-zhao-kun",
    slug: "li-zhao-kun",
    name: "李昭昆",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "三阶速拧亚洲级选手，擅长六色底解法，三阶平均亚洲前十、中国前十，个人三阶平均最佳 5.56s、单次最佳 4.33s。GAN战队成员。",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2024LIZH03",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2024LIZH03"
  },
  {
    id: "ct-fu-he-yu",
    slug: "fu-he-yu",
    name: "付荷语",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "三阶、四阶女子顶尖选手，三阶女子平均世界第六、亚洲第三，四阶女子平均亚洲第二、中国第一，个人三阶平均最佳 6.66s、单次最佳 5.04s。GAN战队成员。",
    visible: true,
    mainEvent: "三阶 / 四阶",
    wcaId: "2019FUHE01",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2019FUHE01"
  },
  {
    id: "ct-dong-yi-ze",
    slug: "dong-yi-ze",
    name: "董一泽",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "三阶速拧选手，6 岁起习得全 ZB 高级解法，个人三阶平均最佳 5.64s、单次最佳 4.79s。GAN战队成员。",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2023DONG20",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2023DONG20"
  },
  {
    id: "ct-guo-kai-xi",
    slug: "guo-kai-xi",
    name: "郭铠希",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "斜转项目专项选手，斜转平均世界前五、亚洲第一，个人斜转平均最佳 1.84s、单次最佳 1.42s。GAN战队成员。",
    visible: true,
    mainEvent: "斜转",
    wcaId: "2023GUOK01",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2023GUOK01"
  },
  {
    id: "ct-huang-hui-ning",
    slug: "huang-hui-ning",
    name: "黄徽宁",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "二阶、金字塔双项顶尖选手，二阶平均亚洲前五，金字塔平均世界前十、亚洲第二，个人二阶平均最佳 1.19s、金字塔平均最佳 1.62s。GAN战队成员。",
    visible: true,
    mainEvent: "二阶 / 金字塔",
    wcaId: "2019HUAH03",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2019HUAH03"
  },

  // GURUS（爆速社）
  {
    id: "ct-gao-yun-miao",
    slug: "gao-yun-miao",
    name: "高云淼",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "宇宙爆速社领航队成员",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2019GAOY03",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2019GAOY03"
  },
  {
    id: "ct-zheng-ming-zhu",
    slug: "zheng-ming-zhu",
    name: "郑名竹",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "宇宙爆速社领航队成员",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2024ZHEN03",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2024ZHEN03"
  },
  {
    id: "ct-zhang-han-di",
    slug: "zhang-han-di",
    name: "张涵涤",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "宇宙爆速社领航队成员",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2023ZHAN76",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2023ZHAN76"
  },
  {
    id: "ct-xu-ya-qian",
    slug: "xu-ya-qian",
    name: "徐雅芊",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "宇宙爆速社领航队成员",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2025XUYA01",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2025XUYA01"
  },
  {
    id: "ct-xia-zi-chen",
    slug: "xia-zi-chen",
    name: "夏紫晨",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "爆速社成员，GURUS团队，2026年辽宁省魔方公开赛 U9 女子组第二名",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2024XIAZ03",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2024XIAZ03"
  },
  {
    id: "ct-li-you-xuan",
    slug: "li-you-xuan",
    name: "李祐萱",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "爆速社成员，GURUS团队，2026年辽宁省魔方公开赛 U12 女子组第五名",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2024LIYU03",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2024LIYU03"
  },
  {
    id: "ct-han-mu-yao",
    slug: "han-mu-yao",
    name: "韩沐遥",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "宇宙爆速社领航队成员",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2024HANM01",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2024HANM01"
  },
  {
    id: "ct-wang-yi-tong",
    slug: "wang-yi-tong",
    name: "王一桐",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2024WANG59",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2024WANG59"
  },

  // 宇宙爆速社·启航队
  {
    id: "ct-meng-si-jun",
    slug: "meng-si-jun",
    name: "孟思竣",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2023MENG07",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2023MENG07"
  },
  {
    id: "ct-wang-guan-ze",
    slug: "wang-guan-ze",
    name: "王冠泽",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2024WANG11",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2024WANG11"
  },
  {
    id: "ct-jin-yi-lin",
    slug: "jin-yi-lin",
    name: "金奕霖",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2023JINY04",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2023JINY04"
  },
  {
    id: "ct-wang-zi-hao",
    slug: "wang-zi-hao",
    name: "王梓灏",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2024WANG65",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2024WANG65"
  },
  {
    id: "ct-li-yu-tong",
    slug: "li-yu-tong",
    name: "李雨桐",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2024LIYU06",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2024LIYU06"
  },
  {
    id: "ct-zhu-fei-ran",
    slug: "zhu-fei-ran",
    name: "朱斐然",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2023ZHUF02",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2023ZHUF02"
  },
  {
    id: "ct-wang-hao-ze",
    slug: "wang-hao-ze",
    name: "王皓泽",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "",
    visible: true,
    mainEvent: "三阶速拧"
  },
  {
    id: "ct-hua-xia",
    slug: "hua-xia",
    name: "华夏",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2024HUAX01",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2024HUAX01"
  },

  // 魔域战队
  {
    id: "ct-li-zi-zhen",
    slug: "li-zi-zhen",
    name: "李子贞",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "魔域战队成员，魔域文化",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2024LIZI01",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2024LIZI01"
  },

  // 魔域梦之队
  {
    id: "ct-li-yi-ting-yang",
    slug: "li-yi-ting-yang",
    name: "李易庭洋",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "魔域梦之队成员，参加多场省内外赛事",
    visible: true,
    mainEvent: "三阶速拧",
    wcaId: "2025LIYI02",
    wcaUrl: "https://www.worldcubeassociation.org/persons/2025LIYI02"
  },
  {
    id: "ct-jiang-ming-lang-hld",
    slug: "jiang-ming-lang-hld",
    name: "蒋铭朗",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "葫芦岛",
    gender: "男",
    bio: "魔域梦之队成员（葫芦岛）",
    visible: true,
    mainEvent: "三阶速拧"
  },
  {
    id: "ct-han-yu-xuan-hld",
    slug: "han-yu-xuan-hld",
    name: "韩雨轩",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "葫芦岛",
    gender: "女",
    bio: "魔域梦之队成员（葫芦岛）",
    visible: true,
    mainEvent: "三阶速拧"
  },
  {
    id: "ct-li-jing-hao-hld",
    slug: "li-jing-hao-hld",
    name: "李靖豪",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "葫芦岛",
    gender: "男",
    bio: "魔域梦之队成员（葫芦岛）",
    visible: true,
    mainEvent: "三阶速拧"
  },
  {
    id: "ct-wang-shu-hld",
    slug: "wang-shu-hld",
    name: "王澍",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "葫芦岛",
    gender: "男",
    bio: "魔域梦之队成员（葫芦岛）",
    visible: true,
    mainEvent: "三阶速拧"
  },

  // 未来星之队
  {
    id: "ct-sun-yan-ru",
    slug: "sun-yan-ru",
    name: "孙琰茹",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "未来星之队成员，奇艺魔方格",
    visible: true,
    mainEvent: "三阶速拧"
  },
  {
    id: "ct-wu-ming-xuan",
    slug: "wu-ming-xuan",
    name: "吴明轩",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "未来星之队成员，奇艺魔方格",
    visible: true,
    mainEvent: "三阶速拧"
  }
];

export const commercialTeams: CommercialTeam[] = [
  {
    id: "gan-gurus",
    name: "GAN Gurus",
    sponsor: "GANCUBE",
    brandUrl: "https://www.gancube.com",
    description: "GAN Gurus 是 GANCUBE 旗下顶级竞技战队，2017 年成立，同年签约 Feliks Zemdegs 为全球代言人。战队汇聚国内外顶尖选手，多人持有世界、亚洲纪录，是 GANCUBE 竞技版图的核心力量。",
    members: commercialTeamMembers.filter(m =>
      ["韩业臻", "李昭昆", "付荷语", "董一泽", "郭铠希", "黄徽宁"].includes(m.name)
    )
  },
  {
    id: "speed-ace-linghang",
    name: "宇宙爆速社·领航队",
    sponsor: "GANCUBE · Speed ACE",
    brandUrl: "https://www.gancube.com",
    description: "Speed ACE（宇宙爆速社）是 GANCUBE 旗下面向青少年的梯队体系，分为领航队和启航队。领航队汇聚省内成绩突出的青少年选手，多人已在 WCA 赛事中取得优异名次。",
    members: commercialTeamMembers.filter(m =>
      ["高云淼", "郑名竹", "张涵涤", "夏紫晨", "徐雅芊", "李祐萱", "韩沐遥"].includes(m.name)
    )
  },
  {
    id: "speed-ace-qihang",
    name: "宇宙爆速社·启航队",
    sponsor: "GANCUBE · Speed ACE",
    brandUrl: "https://www.gancube.com",
    description: "启航队是宇宙爆速社面向新生代选手的培养梯队，成员持续更新中。",
    members: commercialTeamMembers.filter(m =>
      ["王一桐", "孟思竣", "王冠泽", "金奕霖", "王梓灏", "李雨桐", "朱斐然", "王皓泽", "华夏"].includes(m.name)
    )
  },
  {
    id: "mo-yu-team",
    name: "魔域战队",
    sponsor: "魔域文化",
    brandUrl: "https://moyucube.com/en/",
    description: "魔域文化专注于魔方设计、生产和销售，旗下品牌包括魅龙、魔域、傲速等。魔域战队由品牌选拔和资助的高水平选手组成，成员活跃在国内外各类赛事中，致力于速拧项目的全能发展，是推动中国及世界魔方技术提升的重要力量之一。",
    members: commercialTeamMembers.filter(m => ["李子贞"].includes(m.name))
  },
  {
    id: "meng-zhi-team",
    name: "魔域梦之队",
    sponsor: "魔域文化 · 青少年梯队",
    brandUrl: "https://moyucube.com/en/",
    description: "魔域梦之队是魔域旗下青少年梯队，面向具有成长潜力的年轻选手提供训练、器材和赛事支持。辽宁成员来自沈阳、葫芦岛等地，是辽宁魔方战队跨地区合作和青少年培养的重要组成部分。",
    members: commercialTeamMembers.filter(m =>
      ["李易庭洋", "蒋铭朗", "韩雨轩", "李靖豪", "王澍"].includes(m.name)
    )
  },
  {
    id: "future-stars-team",
    name: "未来星之队",
    sponsor: "奇艺魔方格 · QiYi MoFangGe",
    brandUrl: "https://www.qiyitoys.net/en/col.jsp?id=101",
    description: "奇艺魔方格是知名魔方生产和品牌商，致力于魔方自主创新、文化推广和公益活动。未来星之队是奇艺旗下专注推广魔方运动、培养年轻选手的专业化团队，面向有潜力的青少年提供系统训练、顶尖器材支持和展示舞台，并代表奇艺品牌活跃于国内外赛事。",
    members: commercialTeamMembers.filter(m => ["孙琰茹", "吴明轩"].includes(m.name))
  }
];
