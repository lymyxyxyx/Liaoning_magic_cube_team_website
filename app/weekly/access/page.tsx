import { KeyRound, LogIn, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "周赛管理员登录 - 辽宁地区魔方信息查询网",
  description: "辽宁线上周赛管理员登录入口"
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
      <div className="admin-login-identity" aria-label="辽宁线上周赛管理员登录">
        <span className="eyebrow">线上周赛 · 管理员入口</span>
        <h1>辽宁地区魔方信息查询网</h1>
        <p>周赛暂不开放选手自行录入，仅管理员可维护选手、成绩和赛制。</p>
        <div className="admin-login-status">
          <ShieldCheck size={18} />
          <span>登录后可录入、修改和删除周赛成绩</span>
        </div>
      </div>

      <form action="/api/weekly-access" className="admin-login-card" method="post">
        <input name="next" type="hidden" value={nextPath} />
        <div className="admin-login-heading">
          <span className="icon-tile">
            <KeyRound size={21} />
          </span>
          <div>
            <h2>管理员登录</h2>
            <p>验证后，本设备 7 天内无需重复输入。</p>
          </div>
        </div>
        <label className="field admin-login-password">
          <span>管理员口令</span>
          <span className="admin-login-input-wrap">
            <KeyRound size={18} />
            <input autoComplete="current-password" autoFocus name="password" required type="password" />
          </span>
        </label>
        {params.error === "1" ? (
          <p className="admin-login-error" role="alert">
            管理员口令不正确，请重试。
          </p>
        ) : null}
        <button className="button primary admin-login-submit" type="submit">
          <LogIn size={17} />
          登录并进入周赛
        </button>
      </form>
    </section>
  );
}
