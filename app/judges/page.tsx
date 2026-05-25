import { PageHero } from "@/components/page-hero";
import { readJudges } from "@/lib/judge-store";
import { JudgesClient } from "./judges-client";

export default async function JudgesPage() {
  const judges = await readJudges();

  return (
    <>
      <PageHero label="人员档案" title="裁判员列表">
        记录裁判员编号、姓名、地区、级别与考取年份。
      </PageHero>
      <JudgesClient initialJudges={judges} />
    </>
  );
}
