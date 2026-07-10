import { PersonDetailClient } from "./person-detail-client";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: { wcaId: string } }): Promise<Metadata> {
  const wcaId = params.wcaId.toUpperCase();
  return {
    title: `${wcaId} - 选手详情`,
    description: `查看 WCA 选手 ${wcaId} 的详细成绩、排名与参赛记录`
  };
}

export default function PersonDetailPage({ params }: { params: { wcaId: string } }) {
  return <PersonDetailClient wcaId={params.wcaId.toUpperCase()} />;
}
