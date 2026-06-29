"use client";

import { useState } from "react";

const feedbackTypes = ["信息更正", "成绩问题", "删除/隐藏请求", "合作咨询", "页面问题", "其他"];

export function AboutFeedbackForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setStatus("submitting");
    setNotice("");

    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: formData.get("type"),
        name: formData.get("name"),
        wcaId: formData.get("wcaId"),
        contact: formData.get("contact"),
        message: formData.get("message"),
        website: formData.get("website"),
        pageUrl: window.location.href
      })
    }).catch(() => null);

    if (!response?.ok) {
      const payload = (await response?.json().catch(() => null)) as { message?: string } | null;
      setStatus("error");
      setNotice(payload?.message || "提交失败，请稍后再试，或通过微信联系管理员。");
      return;
    }

    const payload = (await response.json().catch(() => null)) as { id?: string } | null;
    form.reset();
    setStatus("success");
    setNotice(payload?.id ? `已提交，反馈编号：${payload.id}` : "已提交，管理员会尽快查看。");
  }

  return (
    <form className="local-contact-box" onSubmit={handleSubmit}>
      <label className="field">
        反馈类型
        <select name="type" defaultValue="信息更正">
          {feedbackTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        <label className="field">
          姓名
          <input name="name" placeholder="可填写本人或相关选手姓名" />
        </label>
        <label className="field">
          WCA ID
          <input name="wcaId" placeholder="如 2019XXXX01，可留空" />
        </label>
      </div>
      <label className="field">
        联系方式
        <input name="contact" placeholder="微信、邮箱或其他方便联系的方式" />
      </label>
      <label className="field">
        反馈内容
        <textarea name="message" minLength={4} required placeholder="请说明需要更正、隐藏、删除或补充的内容，以及对应页面或资料来源。" />
      </label>
      <label className="feedback-honeypot" aria-hidden="true">
        网站
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <button className="button primary" type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "提交中" : "提交反馈"}
      </button>
      {notice ? <p className={`feedback-notice ${status === "error" ? "error" : ""}`}>{notice}</p> : null}
    </form>
  );
}
