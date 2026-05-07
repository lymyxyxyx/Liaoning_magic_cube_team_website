import { NextRequest, NextResponse } from "next/server";
import { createFeedbackMessage } from "@/lib/feedback-store";

const allowedTypes = new Set(["名单反馈", "成绩问题", "页面问题", "合作咨询", "其他"]);

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | {
        type?: string;
        name?: string;
        wcaId?: string;
        contact?: string;
        message?: string;
        pageUrl?: string;
        website?: string;
      }
    | null;

  if (!payload || payload.website) {
    return NextResponse.json({ message: "Invalid feedback" }, { status: 400 });
  }

  const message = cleanText(payload.message, 1200);
  if (message.length < 4) {
    return NextResponse.json({ message: "请填写反馈内容" }, { status: 400 });
  }

  const wcaId = cleanText(payload.wcaId, 16).toUpperCase();
  if (wcaId && !/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(wcaId)) {
    return NextResponse.json({ message: "WCA ID 格式不正确" }, { status: 400 });
  }

  const id = await createFeedbackMessage({
    type: allowedTypes.has(payload.type || "") ? payload.type || "名单反馈" : "其他",
    name: cleanText(payload.name, 80),
    wcaId,
    contact: cleanText(payload.contact, 120),
    message,
    pageUrl: cleanText(payload.pageUrl, 240),
    ipAddress: cleanText(request.headers.get("x-forwarded-for")?.split(",")[0] || "", 80),
    userAgent: cleanText(request.headers.get("user-agent") || "", 240)
  });

  return NextResponse.json({ id });
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
