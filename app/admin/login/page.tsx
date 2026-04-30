import { PageHero } from "@/components/page-hero";
import { AdminLoginForm } from "./admin-login-form";
import { Suspense } from "react";

export default function AdminLoginPage() {
  return (
    <>
      <PageHero label="后台管理" title="登录后台">
        请输入管理员密码后进入维护入口。
      </PageHero>
      <Suspense fallback={null}>
        <AdminLoginForm />
      </Suspense>
    </>
  );
}
