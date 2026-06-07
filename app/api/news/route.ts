import { NextResponse } from "next/server";
import { getPublishedNews } from "@/lib/news-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const news = await getPublishedNews();
  return NextResponse.json({ news });
}
