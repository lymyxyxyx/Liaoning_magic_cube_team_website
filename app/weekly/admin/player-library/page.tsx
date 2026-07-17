import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { verifySessionToken } from "@/lib/auth";
import { getMofang602SeedWeeklyPlayers, listWeeklyPlayerLibrary } from "@/lib/weekly-player-library";
import { WeeklyPlayerLibraryConsole } from "../weekly-player-library-console";

export const dynamic = "force-dynamic";

export default async function WeeklyPlayerLibraryPage() {
  const sessionToken = (await cookies()).get("liaoning_weekly_session")?.value || "";
  if (!sessionToken || !(await verifySessionToken(sessionToken))) redirect("/weekly/results");

  const players = await listWeeklyPlayerLibrary().catch(() => getMofang602SeedWeeklyPlayers());
  return (
    <>
      <PageHero label="周赛管理" title="选手大库" actions={<Link className="button" href="/weekly/results">返回周赛成绩</Link>}>
        维护生日和年龄组别。生日优先，组别暂时可以留空，后续可由管理员补齐。
      </PageHero>
      <WeeklyPlayerLibraryConsole initialPlayers={players} apiPath="/api/admin/weekly-player-library" />
    </>
  );
}
