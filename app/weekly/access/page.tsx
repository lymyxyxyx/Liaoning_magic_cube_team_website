import { KeyRound, LogIn, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "周赛试用入口 - 辽宁地区魔方信息查询网",
  description: "辽宁线上周赛试用入口"
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
      <div className="admin-login-identity" aria-label="辽宁线上周赛试用入口">
        <span className="eyebrow">线上周赛 · 小范围试用</span>
        <h1>辽宁地区魔方信息查询网</h1>
        <p>输入邀请码后即可参加本周周赛并录入自己的成绩。</p>
        <div className="admin-login-status">
          <ShieldCheck size={18} />
          <span>邀请码仅供受邀选手使用</span>
        </div>
      </div>

      <form action="/api/weekly-access" className="admin-login-card" method="post">
        <input name="next" type="hidden" value={nextPath} />
        <div className="admin-login-heading">
          <span className="icon-tile">
            <KeyRound size={21} />
          </span>
          <div>
            <h2>进入周赛</h2>
            <p>邀请码验证后，本设备 7 天内无需重复输入。</p>
          </div>
        </div>
        <label className="field admin-login-password">
          <span>周赛邀请码</span>
          <span className="admin-login-input-wrap">
            <KeyRound size={18} />
            <input autoComplete="off" autoFocus name="inviteCode" required type="password" />
          </span>
        </label>
        {params.error === "1" ? (
          <p className="admin-login-error" role="alert">
            邀请码不正确，请向组织者确认后重试。
          </p>
        ) : null}
        <button className="button primary admin-login-submit" type="submit">
          <LogIn size={17} />
          进入周赛
        </button>
      </form>
    </section>
  );
}
