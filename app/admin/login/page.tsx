import { PageHero } from "@/components/page-hero";
import { AdminLoginForm } from "./admin-login-form";
import { Suspense } from "react";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "登录后台 - 辽宁魔方战队",
  description: "后台管理系统登录页面"
};

export default function AdminLoginPage() {
  return (
    <>
      {/* DNS 预解析和 TCP 预连接，加快 API 请求速度 */}
      <link rel="dns-prefetch" href="//lncubing.com" />
      <link rel="preconnect" href="https://lncubing.com" />
      
      <PageHero label="后台管理" title="登录后台">
        请输入管理员密码后进入维护入口。
      </PageHero>
      <Suspense fallback={null}>
        <AdminLoginForm />
      </Suspense>
    </>
  );
}
