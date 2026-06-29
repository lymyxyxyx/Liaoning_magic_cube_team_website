"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { type CommercialProfileSubmission, type CommercialSubmissionStatus } from "@/lib/commercial-profile-submissions";

const statusLabels: Record<CommercialSubmissionStatus, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已驳回"
};

export function CommercialSubmissionsConsole() {
  const [submissions, setSubmissions] = useState<CommercialProfileSubmission[]>([]);
  const [status, setStatus] = useState("读取中...");
  const [filter, setFilter] = useState<CommercialSubmissionStatus | "all">("pending");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    fetch("/api/admin/commercial-profile-submissions")
      .then((response) => response.json())
      .then((payload) => {
        setSubmissions(Array.isArray(payload.submissions) ? payload.submissions : []);
        setStatus("");
      })
      .catch(() => setStatus("读取提交失败，请刷新重试。"));
  }, []);

  const filteredSubmissions = useMemo(() => {
    if (filter === "all") return submissions;
    return submissions.filter((submission) => submission.status === filter);
  }, [filter, submissions]);

  const counts = useMemo(
    () => ({
      all: submissions.length,
      pending: submissions.filter((submission) => submission.status === "pending").length,
      approved: submissions.filter((submission) => submission.status === "approved").length,
      rejected: submissions.filter((submission) => submission.status === "rejected").length
    }),
    [submissions]
  );

  async function updateStatus(id: string, nextStatus: CommercialSubmissionStatus) {
    setSavingId(id);
    setStatus("保存中...");
    try {
      const response = await fetch("/api/admin/commercial-profile-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus, reviewNote: reviewNotes[id] || "" })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "保存失败。");
      setSubmissions(Array.isArray(payload.submissions) ? payload.submissions : []);
      setStatus("已保存。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setSavingId("");
    }
  }

  async function copyBio(submission: CommercialProfileSubmission) {
    const text = `${submission.playerName}\n${submission.bio}`;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("已复制简介。");
    } catch {
      setStatus("复制失败，可以手动选中文本。");
    }
  }

  return (
    <section className="container section commercial-review-console">
      <div className="commercial-review-toolbar">
        <div className="commercial-review-tabs" aria-label="审核状态筛选">
          <button className={filter === "pending" ? "active" : ""} type="button" onClick={() => setFilter("pending")}>
            待审核 {counts.pending}
          </button>
          <button className={filter === "approved" ? "active" : ""} type="button" onClick={() => setFilter("approved")}>
            已通过 {counts.approved}
          </button>
          <button className={filter === "rejected" ? "active" : ""} type="button" onClick={() => setFilter("rejected")}>
            已驳回 {counts.rejected}
          </button>
          <button className={filter === "all" ? "active" : ""} type="button" onClick={() => setFilter("all")}>
            全部 {counts.all}
          </button>
        </div>
        {status ? <span className="commercial-review-status">{status}</span> : null}
      </div>

      {filteredSubmissions.length === 0 ? (
        <div className="news-empty">当前没有成员简介提交。</div>
      ) : (
        <div className="commercial-review-list">
          {filteredSubmissions.map((submission) => (
            <article className="commercial-review-card" key={submission.id}>
              <header>
                <div>
                  <span className={`commercial-review-badge status-${submission.status}`}>{statusLabels[submission.status]}</span>
                  <h2>{submission.playerName}</h2>
                  <p>
                    {submission.teamName || "未填写战队"}
                    {submission.city ? ` · ${submission.city}` : ""}
                    {submission.wcaId ? ` · ${submission.wcaId}` : ""}
                  </p>
                </div>
                <button className="button" type="button" onClick={() => copyBio(submission)}>
                  <Copy size={15} />
                  复制简介
                </button>
              </header>

              <div className="commercial-review-meta">
                <span>主项：{submission.mainEvent || "未填写"}</span>
                <span>提交人：{submission.submitterRole || "未填写"}</span>
                <span>联系方式：{submission.contact || "未填写"}</span>
                <span>提交时间：{formatDate(submission.createdAt)}</span>
              </div>

              <label className="commercial-review-field">
                简介内容
                <textarea value={submission.bio} readOnly />
              </label>
              {submission.note ? (
                <label className="commercial-review-field">
                  提交备注
                  <textarea value={submission.note} readOnly />
                </label>
              ) : null}
              <label className="commercial-review-field">
                审核备注
                <textarea
                  value={reviewNotes[submission.id] ?? submission.reviewNote ?? ""}
                  onChange={(event) => setReviewNotes((current) => ({ ...current, [submission.id]: event.target.value }))}
                  placeholder="可记录已联系、需补充证明、已手动更新展示等。"
                />
              </label>

              <div className="commercial-review-actions">
                <button
                  className="button primary"
                  type="button"
                  disabled={savingId === submission.id}
                  onClick={() => updateStatus(submission.id, "approved")}
                >
                  <Check size={15} />
                  通过
                </button>
                <button
                  className="button button--danger"
                  type="button"
                  disabled={savingId === submission.id}
                  onClick={() => updateStatus(submission.id, "rejected")}
                >
                  <X size={15} />
                  驳回
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}
