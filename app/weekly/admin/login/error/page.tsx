import { type Metadata } from "next";
import { WeeklyLoginForm } from "../weekly-login-form";

export const metadata: Metadata = {
  title: "周赛后台登录 - 辽宁地区魔方信息查询网",
  description: "周赛成绩录入后台登录页面"
};

export default function WeeklyLoginErrorPage() {
  return <WeeklyLoginForm hasError />;
}
