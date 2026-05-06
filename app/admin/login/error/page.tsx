import { AdminLoginForm } from "../admin-login-form";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "登录后台 - 辽宁地区魔方信息查询网",
  description: "后台管理系统登录页面"
};

export default function AdminLoginErrorPage() {
  return <AdminLoginForm hasError />;
}
