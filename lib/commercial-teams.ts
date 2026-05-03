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
    name: "韩邺臻",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "GAN战队成员",
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
    bio: "GAN战队成员",
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
    bio: "GAN战队成员",
    visible: true,
    mainEvent: "三阶速拧",
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
    bio: "GAN战队成员",
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
    bio: "GAN战队成员",
    visible: true,
    mainEvent: "三阶速拧",
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
    bio: "GAN战队成员",
    visible: true,
    mainEvent: "三阶速拧",
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
    bio: "爆速社成员，GURUS团队",
    visible: true,
    mainEvent: "三阶速拧"
  },
  {
    id: "ct-zheng-ming-zhu",
    slug: "zheng-ming-zhu",
    name: "郑名竹",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "爆速社成员，GURUS团队",
    visible: true,
    mainEvent: "三阶速拧"
  },
  {
    id: "ct-zhang-han-di",
    slug: "zhang-han-di",
    name: "张涵涤",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "爆速社成员，GURUS团队",
    visible: true,
    mainEvent: "三阶速拧"
  },
  {
    id: "ct-xu-ya-qian",
    slug: "xu-ya-qian",
    name: "徐雅芊",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "爆速社成员，GURUS团队",
    visible: true,
    mainEvent: "三阶速拧"
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
    bio: "爆速社成员，GURUS团队",
    visible: true,
    mainEvent: "三阶速拧"
  },
  {
    id: "ct-wang-yi-tong",
    slug: "wang-yi-tong",
    name: "王一桐",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "爆速社成员，GURUS团队",
    visible: true,
    mainEvent: "三阶速拧"
  },

  // 华夏
  {
    id: "ct-meng-si-jun",
    slug: "meng-si-jun",
    name: "孟思竣",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "华夏战队成员",
    visible: true,
    mainEvent: "三阶速拧"
  },
  {
    id: "ct-wang-guan-ze",
    slug: "wang-guan-ze",
    name: "王冠泽",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "华夏战队成员",
    visible: true,
    mainEvent: "三阶速拧"
  },
  {
    id: "ct-jin-yi-lin",
    slug: "jin-yi-lin",
    name: "金奕霖",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "华夏战队成员",
    visible: true,
    mainEvent: "三阶速拧"
  },
  {
    id: "ct-wang-zi-hao",
    slug: "wang-zi-hao",
    name: "王梓灏",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "华夏战队成员",
    visible: true,
    mainEvent: "三阶速拧"
  },
  {
    id: "ct-li-yu-tong",
    slug: "li-yu-tong",
    name: "李雨桐",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "女",
    bio: "华夏战队成员",
    visible: true,
    mainEvent: "三阶速拧"
  },
  {
    id: "ct-zhu-fei-ran",
    slug: "zhu-fei-ran",
    name: "朱斐然",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "华夏战队成员",
    visible: true,
    mainEvent: "三阶速拧"
  },
  {
    id: "ct-wang-hao-ze",
    slug: "wang-hao-ze",
    name: "王浩泽",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "华夏战队成员",
    visible: true,
    mainEvent: "三阶速拧"
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

  // 梦之队
  {
    id: "ct-li-yi-ting-yang",
    slug: "li-yi-ting-yang",
    name: "李易庭洋",
    avatar: "/visuals/avatar-default.svg",
    roles: ["运动员"],
    city: "沈阳",
    gender: "男",
    bio: "梦之队成员，参加多场省内外赛事",
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
    bio: "梦之队成员（葫芦岛）",
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
    bio: "梦之队成员（葫芦岛）",
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
    bio: "梦之队成员（葫芦岛）",
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
    bio: "梦之队成员（葫芦岛）",
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
    id: "gan-team",
    name: "GAN战队",
    sponsor: "GANCUBE",
    brandUrl: "https://www.gancube.com",
    description: "GANCUBE 于 2017 年成立 GAN Gurus 战队，同年签约 Feliks Zemdegs 为全球品牌代言人。随着越来越多的国际顶尖选手加入，战队持续成为魔方界重要的培育力量，目前旗下拥有 GAN Gurus 和 Speed ACE（宇宙爆速社）两支战队。GANCUBE 长期致力于通过赞助赛事推动魔方运动发展，赞助版图覆盖全球 100 余座城市，包括巴黎世锦赛、红牛世锦赛等里程碑赛事，以及多站全国魔方公开赛、WCA 广东公开赛和 WCA 北京公开赛等国内重要赛事。",
    members: commercialTeamMembers.filter(m =>
      ["韩邺臻", "李昭昆", "付荷语", "董一泽", "郭铠希", "黄徽宁"].includes(m.name)
    )
  },
  {
    id: "gurus-bao-su-she",
    name: "GURUS（爆速社）",
    sponsor: "GANCUBE",
    brandUrl: "https://www.gancube.com",
    description: "Speed ACE / 宇宙爆速社是 GANCUBE 旗下面向青少年选手的战队，专注发掘和培养新生代魔方竞技人才。辽宁队员长期活跃于省内外赛事，多人在辽宁省公开赛中取得优异成绩。",
    members: commercialTeamMembers.filter(m =>
      ["高云淼", "郑名竹", "张涵涤", "徐雅芊", "夏紫晨", "李祐萱", "韩沐遥", "王一桐"].includes(m.name)
    )
  },
  {
    id: "hua-xia-team",
    name: "华夏战队",
    sponsor: "华夏魔方",
    description: "华夏战队是国内知名魔方品牌华夏魔方旗下竞技团队，辽宁成员覆盖多个年龄组，在省级赛事中有稳定表现。",
    members: commercialTeamMembers.filter(m =>
      ["孟思竣", "王冠泽", "金奕霖", "王梓灏", "李雨桐", "朱斐然", "王浩泽"].includes(m.name)
    )
  },
  {
    id: "mo-yu-team",
    name: "魔域战队",
    sponsor: "魔域文化",
    description: "魔域文化旗下战队，专注三阶速拧及多项目全能培训，辽宁成员积极参与省内各级别赛事。",
    members: commercialTeamMembers.filter(m => ["李子贞"].includes(m.name))
  },
  {
    id: "meng-zhi-team",
    name: "梦之队",
    description: "梦之队汇聚辽宁省内外多城市选手，成员来自沈阳、葫芦岛等地，是辽宁魔方战队跨地区合作的重要组成部分。",
    members: commercialTeamMembers.filter(m =>
      ["李易庭洋", "蒋铭朗", "韩雨轩", "李靖豪", "王澍"].includes(m.name)
    )
  },
  {
    id: "future-stars-team",
    name: "未来星之队",
    sponsor: "奇艺魔方格",
    brandUrl: "https://www.qiyi.com",
    description: "奇艺魔方格旗下青少年战队，致力于通过专业器材支持和系统训练帮助年轻选手成长，辽宁队员在省内青少年赛事中表现积极。",
    members: commercialTeamMembers.filter(m => ["孙琰茹", "吴明轩"].includes(m.name))
  }
];
