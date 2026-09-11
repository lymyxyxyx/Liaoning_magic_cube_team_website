"use client";

import { FormEvent, useState } from "react";

export function WeeklyInlineAdminLogin({ isAdmin }: { isAdmin: boolean }) {
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password.trim()) return;
    setSubmitting(true);
    setNotice("");
    try {
      const response = await fetch("/api/weekly-login-inline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || "管理员密码不正确");
      // A full navigation makes the newly issued httpOnly cookie available to
      // the server-rendered weekly console immediately; no second login is
      // required to unlock score entry.
      window.location.assign("/weekly");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "管理员登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (isAdmin) return <><span className="weekly-admin-mode">管理员模式</span><form className="weekly-admin-exit" action="/api/weekly-auth/logout" method="post"><button type="submit">退出管理</button></form></>;

  return (
    <details className="weekly-inline-admin-login">
      <summary>管理员登录</summary>
      <form onSubmit={submit}>
        <label>
          <span className="sr-only">管理员密码</span>
          <input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} placeholder="管理员密码" type="password" value={password} />
        </label>
        <button className="button primary" disabled={submitting || !password.trim()} type="submit">
          {submitting ? "验证中…" : "登录"}
        </button>
        {notice ? <p role="alert">{notice}</p> : null}
      </form>
    </details>
  );
}
