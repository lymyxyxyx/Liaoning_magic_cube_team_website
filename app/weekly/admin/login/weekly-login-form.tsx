import { KeyRound, LogIn, TimerReset } from "lucide-react";

export function WeeklyLoginForm({ hasError = false }: { hasError?: boolean }) {
  return (
    <section className="admin-login-shell">
      <div className="admin-login-identity" aria-label="周赛录入后台">
        <span className="eyebrow">周赛录入</span>
        <h1>周赛成绩后台</h1>
        <p>粘贴 Excel 表格数据，生成结构化周赛成绩。</p>
        <div className="admin-login-status">
          <TimerReset size={18} />
          <span>独立口令入口</span>
        </div>
      </div>

      <form action="/api/weekly-auth" className="admin-login-card" method="post">
        <div className="admin-login-heading">
          <span className="icon-tile">
            <TimerReset size={21} />
          </span>
          <div>
            <h2>登录周赛后台</h2>
            <p>请输入周赛录入口令继续。</p>
          </div>
        </div>
        <label className="field admin-login-password">
          <span>周赛口令</span>
          <span className="admin-login-input-wrap">
            <KeyRound size={18} />
            <input autoComplete="current-password" autoFocus name="password" type="password" />
          </span>
        </label>
        {hasError ? (
          <p className="admin-login-error" role="alert">
            口令不正确，请重新输入。
          </p>
        ) : null}
        <button className="button primary admin-login-submit" type="submit">
          <LogIn size={17} />
          进入周赛后台
        </button>
      </form>
    </section>
  );
}
