"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const response = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        setError("密码不正确，请重新输入。");
        setPassword("");
        return;
      }

      // 密码验证成功后，直接导航（无需 router.refresh()）
      // httpOnly cookie 已由后端设置，浏览器会自动携带
      router.replace(getSafeNextPath(searchParams.get("next")));
    });
  }

  return (
    <section className="container section">
      <form className="admin-card admin-login-card" onSubmit={handleSubmit}>
        <h2>后台登录</h2>
        <label className="field">
          <span>管理密码</span>
          <input
            autoComplete="current-password"
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="admin-login-error">{error}</p> : null}
        <button className="button primary" disabled={isPending} type="submit">
          <LogIn size={17} />
          {isPending ? "验证中" : "进入后台"}
        </button>
      </form>
    </section>
  );
}

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/admin/accounts";
  if (value.startsWith("/admin/login")) return "/admin/accounts";
  return value;
}
