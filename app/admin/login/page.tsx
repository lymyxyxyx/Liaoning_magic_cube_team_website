import { PageHero } from "@/components/page-hero";
import { AdminLoginForm } from "./admin-login-form";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "登录后台 - 辽宁魔方战队",
  description: "后台管理系统登录页面"
};

export default function AdminLoginPage({
  searchParams
}: {
  searchParams?: {
    next?: string;
    error?: string;
  };
}) {
  const nextPath = getSafeNextPath(searchParams?.next || null);

  return (
    <>
      <PageHero label="后台管理" title="登录后台">
        请输入管理员密码后进入维护入口。
      </PageHero>
      <AdminLoginForm nextPath={nextPath} hasError={searchParams?.error === "1"} />
    </>
  );
}

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/admin/accounts";
  if (value.startsWith("/admin/login")) return "/admin/accounts";
  return value;
}
