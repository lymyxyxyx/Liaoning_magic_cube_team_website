import { KeyRound, LogIn, ShieldCheck } from "lucide-react";

export function AdminLoginForm({ hasError = false }: { hasError?: boolean }) {
  return (
    <section className="admin-login-shell">
      <div className="admin-login-identity" aria-label="辽宁地区魔方信息查询网后台">
        <span className="eyebrow">后台管理</span>
        <h1>辽宁地区魔方信息查询网</h1>
        <p>维护选手档案、赛事记录与账本数据。</p>
        <div className="admin-login-status">
          <ShieldCheck size={18} />
          <span>管理员验证入口</span>
        </div>
      </div>

      <form action="/api/admin-auth" className="admin-login-card" method="post">
        <div className="admin-login-heading">
          <span className="icon-tile">
            <ShieldCheck size={21} />
          </span>
          <div>
            <h2>登录后台</h2>
            <p>请输入管理密码继续。</p>
          </div>
        </div>
        <label className="field admin-login-password">
          <span>管理密码</span>
          <span className="admin-login-input-wrap">
            <KeyRound size={18} />
            <input autoComplete="current-password" autoFocus name="password" type="password" />
          </span>
        </label>
        {hasError ? (
          <p className="admin-login-error" role="alert">
            密码不正确，请重新输入。
          </p>
        ) : null}
        <button className="button primary admin-login-submit" type="submit">
          <LogIn size={17} />
          进入后台
        </button>
      </form>
    </section>
  );
}
