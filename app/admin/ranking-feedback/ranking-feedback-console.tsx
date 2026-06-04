"use client";

import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";

type FeedbackStatus = "new" | "reviewing" | "resolved";

type FeedbackMessage = {
  id: string;
  type: string;
  name: string;
  wcaId: string;
  contact: string;
  message: string;
  pageUrl: string;
  status: FeedbackStatus;
  createdAt: string;
};

const feedbackStatusLabels: Record<FeedbackStatus, string> = {
  new: "新反馈",
  reviewing: "跟进中",
  resolved: "已处理"
};

export function RankingFeedbackConsole() {
  const [feedbackMessages, setFeedbackMessages] = useState<FeedbackMessage[]>([]);
  const [feedbackStatus, setFeedbackStatus] = useState("读取中");

  useEffect(() => {
    fetch("/api/admin/feedback")
      .then((response) => {
        if (!response.ok) throw new Error("feedback");
        return response.json();
      })
      .then((payload) => {
        setFeedbackMessages(payload.messages || []);
        setFeedbackStatus("已读取");
      })
      .catch(() => setFeedbackStatus("读取失败"));
  }, []);

  function updateFeedbackStatus(id: string, status: FeedbackStatus) {
    setFeedbackStatus("保存中");
    fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    })
      .then((response) => {
        if (!response.ok) throw new Error("feedback");
        return response.json();
      })
      .then((payload) => {
        const nextMessage = payload.message as FeedbackMessage;
        setFeedbackMessages((current) => current.map((message) => (message.id === nextMessage.id ? nextMessage : message)));
        setFeedbackStatus("已保存");
      })
      .catch(() => setFeedbackStatus("保存失败"));
  }

  return (
    <section className="container section admin-console-shell">
      <div className="admin-workspace-heading">
        <div>
          <h1>辽宁排名认定说明</h1>
          <p>这部分先放在后台维护，前台排名页只保留筛选和名单。</p>
        </div>
        <span className="status">{feedbackStatus}</span>
      </div>

      <div className="admin-card local-eligibility-card">
        <h2>认定口径</h2>
        <ol>
          <li>户口本或身份证显示为辽宁户籍。</li>
          <li>户口本或身份证曾为辽宁户籍，后已取得外省或外国身份。</li>
          <li>户口本或身份证曾不是辽宁户籍，但现已取得辽宁省户籍。</li>
        </ol>
      </div>

      <div className="admin-card admin-feedback-card">
        <div className="admin-card-heading">
          <div>
            <h2>名单反馈</h2>
            <p>免登录表单提交的名单、成绩和页面问题会汇总在这里。</p>
          </div>
          <span className="admin-local-count">{feedbackMessages.length} 条</span>
        </div>
        {feedbackMessages.length > 0 ? (
          <div className="admin-feedback-list">
            {feedbackMessages.map((message) => (
              <article className="admin-feedback-item" key={message.id}>
                <div className="admin-feedback-head">
                  <span className={`status ${message.status === "resolved" ? "status-高" : message.status === "reviewing" ? "" : "status-低"}`}>
                    {feedbackStatusLabels[message.status]}
                  </span>
                  <strong>{message.type}</strong>
                  <small>{formatDateTime(message.createdAt)}</small>
                </div>
                <p>{message.message}</p>
                <div className="admin-feedback-meta">
                  <span>姓名：{message.name || "-"}</span>
                  <span>WCA ID：{message.wcaId || "-"}</span>
                  <span>联系方式：{message.contact || "-"}</span>
                  {message.pageUrl ? <span>页面：{message.pageUrl}</span> : null}
                </div>
                <div className="admin-profile-actions">
                  <button className="button" type="button" onClick={() => updateFeedbackStatus(message.id, "reviewing")}>
                    <Inbox size={16} />
                    跟进中
                  </button>
                  <button className="button" type="button" onClick={() => updateFeedbackStatus(message.id, "resolved")}>
                    处理完成
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-inline-notice">暂无用户反馈。</p>
        )}
      </div>
    </section>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "历史数据";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "历史数据";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
