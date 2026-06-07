import { NextRequest, NextResponse } from "next/server";
import { readNews, writeNews, type NewsItem } from "@/lib/news-store";

// Session-gated by middleware (/api/admin/*). Returns all items including drafts.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const news = await readNews();
    return NextResponse.json({ news });
  } catch (error) {
    console.error("admin news list failed", error);
    return NextResponse.json({ message: "读取新闻失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as { news?: NewsItem[] } | null;
  if (!Array.isArray(payload?.news)) {
    return NextResponse.json({ message: "新闻数据不正确" }, { status: 400 });
  }

  try {
    const news = await writeNews(payload.news);
    return NextResponse.json({ news });
  } catch (error) {
    console.error("admin news save failed", error);
    return NextResponse.json({ message: "保存新闻失败" }, { status: 500 });
  }
}
