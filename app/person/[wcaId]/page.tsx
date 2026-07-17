import { PersonDetailClient } from "./person-detail-client";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ wcaId: string }> }): Promise<Metadata> {
  const { wcaId: rawWcaId } = await params;
  const wcaId = rawWcaId.toUpperCase();
  return {
    title: `${wcaId} - 选手详情`,
    description: `查看 WCA 选手 ${wcaId} 的详细成绩、排名与参赛记录`
  };
}

export default async function PersonDetailPage({ params }: { params: Promise<{ wcaId: string }> }) {
  const { wcaId } = await params;
  return <PersonDetailClient wcaId={wcaId.toUpperCase()} />;
}
