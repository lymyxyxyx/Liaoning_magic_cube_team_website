import { PageHero } from "@/components/page-hero";
import { readCoaches } from "@/lib/coach-store";
import { CoachesClient } from "./coaches-client";

export default async function CoachesPage() {
  const coaches = await readCoaches();

  return (
    <>
      <PageHero label="人员档案" title="教练员列表">
        记录教练员编号、姓名、地区、级别与资质信息。
      </PageHero>
      <CoachesClient initialCoaches={coaches} />
    </>
  );
}
