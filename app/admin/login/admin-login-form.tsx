"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const response = await fetch("/api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setError("密码不正确，请重新输入。");
      setPassword("");
      return;
    }

    router.replace(getSafeNextPath(searchParams.get("next")));
    router.refresh();
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
        <button className="button primary" disabled={isSubmitting} type="submit">
          <LogIn size={17} />
          {isSubmitting ? "验证中" : "进入后台"}
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
