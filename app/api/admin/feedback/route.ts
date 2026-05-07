import { NextRequest, NextResponse } from "next/server";
import { isFeedbackStatus, listFeedbackMessages, updateFeedbackStatus } from "@/lib/feedback-store";

export async function GET() {
  const messages = await listFeedbackMessages();
  return NextResponse.json({ messages });
}

export async function PATCH(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as { id?: string; status?: string } | null;
  if (!payload?.id || !payload.status || !isFeedbackStatus(payload.status)) {
    return NextResponse.json({ message: "Invalid feedback status" }, { status: 400 });
  }

  const message = await updateFeedbackStatus(payload.id, payload.status);
  if (!message) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json({ message });
}
