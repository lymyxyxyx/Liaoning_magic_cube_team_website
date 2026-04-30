import { LogIn } from "lucide-react";

export function AdminLoginForm({ nextPath, hasError }: { nextPath: string; hasError: boolean }) {
  const action = `/api/admin-auth?next=${encodeURIComponent(nextPath)}`;

  return (
    <section className="container section">
      <form action={action} className="admin-card admin-login-card" method="post">
        <h2>后台登录</h2>
        <label className="field">
          <span>管理密码</span>
          <input autoComplete="current-password" autoFocus name="password" type="password" />
        </label>
        {hasError ? <p className="admin-login-error">密码不正确，请重新输入。</p> : null}
        <button className="button primary" type="submit">
          <LogIn size={17} />
          进入后台
        </button>
      </form>
    </section>
  );
}
