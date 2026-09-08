import { KeyRound, LogIn, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "周赛管理员登录 - 辽宁地区魔方信息查询网",
  description: "辽宁线上周赛后台管理员登录入口"
};

export default async function WeeklyAdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;

  return (
    <section className="admin-login-shell">
      <div className="admin-login-identity" aria-label="辽宁线上周赛后台管理员登录">
        <span className="eyebrow">线上周赛 · 后台管理</span>
        <h1>辽宁地区魔方信息查询网</h1>
        <p>此入口仅供周赛后台管理员使用，普通周赛邀请码不能登录。</p>
        <div className="admin-login-status">
          <ShieldCheck size={18} />
          <span>登录后可维护周赛、选手与成绩</span>
        </div>
      </div>

      <form action="/api/weekly-auth" className="admin-login-card" method="post">
        <div className="admin-login-heading">
          <span className="icon-tile">
            <ShieldCheck size={21} />
          </span>
          <div>
            <h2>登录周赛后台</h2>
            <p>请输入周赛管理员密码继续。</p>
          </div>
        </div>
        <label className="field admin-login-password">
          <span>周赛管理员密码</span>
          <span className="admin-login-input-wrap">
            <KeyRound size={18} />
            <input autoComplete="current-password" autoFocus name="password" required type="password" />
          </span>
        </label>
        {params.error === "1" ? <p className="admin-login-error" role="alert">周赛管理员密码不正确，请重试。</p> : null}
        <button className="button primary admin-login-submit" type="submit">
          <LogIn size={17} />
          登录并进入周赛后台
        </button>
      </form>
    </section>
  );
}
