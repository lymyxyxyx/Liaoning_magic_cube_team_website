import { PageHero } from "@/components/page-hero";
import { WeeklyAdminConsole } from "./weekly-admin-console";

export const dynamic = "force-dynamic";

export default function WeeklyAdminPage() {
  return (
    <>
      <PageHero label="周赛录入" title="周赛成绩后台">
        从 Excel 复制成绩表，粘贴后自动生成排名、预览表格，并保存到网站周赛页面。
      </PageHero>
      <WeeklyAdminConsole />
    </>
  );
}
