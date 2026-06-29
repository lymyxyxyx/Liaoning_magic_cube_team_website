import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { readJudges } from "@/lib/judge-store";
import { JudgesClient } from "./judges-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "裁判员",
  description: "辽宁地区 WCA 魔方裁判名录，含级别、培训信息与所在城市。",
  alternates: { canonical: "/judges" },
  openGraph: {
    type: "website",
    url: "/judges",
    title: "裁判员",
    description: "辽宁地区 WCA 魔方裁判名录与级别信息。"
  }
};

export default async function JudgesPage() {
  const judges = await readJudges();

  return (
    <>
      <PageHero label="人员档案" title="裁判员">
        裁判级别与培训信息。
      </PageHero>
      <JudgesClient initialJudges={judges} />
    </>
  );
}
