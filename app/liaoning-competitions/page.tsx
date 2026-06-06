import { redirect } from "next/navigation";

// 「辽宁WCA赛事」已并入统一的「赛事列表」(/competitions)，旧链接重定向到 WCA 分类。
export default function LiaoningCompetitionsPage() {
  redirect("/competitions?category=wca");
}
