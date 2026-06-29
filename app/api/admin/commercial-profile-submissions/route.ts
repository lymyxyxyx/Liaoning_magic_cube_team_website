import { NextRequest, NextResponse } from "next/server";
import {
  commercialSubmissionStatuses,
  readCommercialProfileSubmissions,
  writeCommercialProfileSubmissions,
  type CommercialSubmissionStatus
} from "@/lib/commercial-profile-submissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const submissions = await readCommercialProfileSubmissions();
    return NextResponse.json({ submissions });
  } catch (error) {
    console.error("commercial submissions list failed", error);
    return NextResponse.json({ message: "读取提交失败。" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as {
    id?: string;
    status?: CommercialSubmissionStatus;
    reviewNote?: string;
  } | null;
  const id = typeof payload?.id === "string" ? payload.id.trim() : "";
  const status = payload?.status;
  if (!id || !commercialSubmissionStatuses.includes(status as CommercialSubmissionStatus)) {
    return NextResponse.json({ message: "审核状态不正确。" }, { status: 400 });
  }

  try {
    const submissions = await readCommercialProfileSubmissions();
    let changed = false;
    const next = submissions.map((submission) => {
      if (submission.id !== id) return submission;
      changed = true;
      return {
        ...submission,
        status: status as CommercialSubmissionStatus,
        reviewedAt: new Date().toISOString(),
        reviewNote: typeof payload?.reviewNote === "string" ? payload.reviewNote.trim() || undefined : undefined
      };
    });
    if (!changed) return NextResponse.json({ message: "没有找到这条提交。" }, { status: 404 });

    const saved = await writeCommercialProfileSubmissions(next);
    return NextResponse.json({ submissions: saved });
  } catch (error) {
    console.error("commercial submissions review failed", error);
    return NextResponse.json({ message: "保存审核状态失败。" }, { status: 500 });
  }
}
