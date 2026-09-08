import { KeyRound, LogIn, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "周赛访问验证 - 辽宁地区魔方信息查询网",
  description: "辽宁线上周赛邀请码验证入口"
};

function getSafeNextPath(value: string | undefined) {
  if (!value?.startsWith("/weekly") || value.startsWith("//") || value.startsWith("/weekly/access") || value.startsWith("/weekly/admin")) {
    return "/weekly/results";
  }
  return value;
}

export default async function WeeklyAccessPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params.next);

  return (
    <section className="admin-login-shell">
      <div className="admin-login-identity" aria-label="辽宁线上周赛访问验证">
        <span className="eyebrow">线上周赛 · 访问验证</span>
        <h1>辽宁地区魔方信息查询网</h1>
        <p>请输入周赛邀请码访问参赛页面；此验证不授予后台管理权限。</p>
        <div className="admin-login-status">
          <ShieldCheck size={18} />
          <span>邀请码仅用于访问受限周赛页面</span>
        </div>
      </div>

      <form action="/api/weekly-access" className="admin-login-card" method="post">
        <input name="next" type="hidden" value={nextPath} />
        <div className="admin-login-heading">
          <span className="icon-tile">
            <KeyRound size={21} />
          </span>
          <div>
            <h2>验证周赛邀请码</h2>
            <p>验证后，本设备 7 天内无需重复输入。</p>
          </div>
        </div>
        <label className="field admin-login-password">
          <span>周赛邀请码</span>
          <span className="admin-login-input-wrap">
            <KeyRound size={18} />
            <input autoComplete="current-password" autoFocus name="password" required type="password" />
          </span>
        </label>
        {params.error === "1" ? (
          <p className="admin-login-error" role="alert">
            周赛邀请码不正确，请重试。
          </p>
        ) : null}
        <button className="button primary admin-login-submit" type="submit">
          <LogIn size={17} />
          验证并进入周赛
        </button>
      </form>
    </section>
  );
}
