import { NextRequest, NextResponse } from "next/server";
import { addCommercialProfileSubmission } from "@/lib/commercial-profile-submissions";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return NextResponse.json({ message: "提交内容格式不正确。" }, { status: 400 });
  }

  const playerName = cleanString(payload.playerName);
  const teamName = cleanString(payload.teamName);
  const bio = cleanString(payload.bio);
  const submitterRole = cleanString(payload.submitterRole);
  const contact = cleanString(payload.contact);
  const city = cleanString(payload.city);
  const wcaId = cleanString(payload.wcaId);
  const mainEvent = cleanString(payload.mainEvent);
  const note = cleanString(payload.note);

  if (!playerName || !teamName || !bio || !submitterRole || !contact) {
    return NextResponse.json({ message: "请填写姓名、战队、简介、提交人身份和联系方式。" }, { status: 400 });
  }
  if (playerName.length > 40 || teamName.length > 80 || contact.length > 120) {
    return NextResponse.json({ message: "姓名、战队或联系方式过长。" }, { status: 400 });
  }
  if (bio.length < 12 || bio.length > 500) {
    return NextResponse.json({ message: "简介建议填写 12-500 个字。" }, { status: 400 });
  }
  if (note.length > 500) {
    return NextResponse.json({ message: "备注内容过长。" }, { status: 400 });
  }

  try {
    const submission = await addCommercialProfileSubmission({
      playerName,
      teamName,
      bio,
      submitterRole,
      contact,
      city,
      wcaId,
      mainEvent,
      note
    });
    return NextResponse.json({ ok: true, submission: { id: submission.id, status: submission.status } });
  } catch (error) {
    console.error("commercial profile submission failed", error);
    return NextResponse.json({ message: "提交失败，请稍后再试。" }, { status: 500 });
  }
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
