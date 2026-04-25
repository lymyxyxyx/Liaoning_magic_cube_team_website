import { PageHero } from "@/components/page-hero";
import { AdminConsole } from "./admin-console";

export default function AdminPage() {
  return (
    <>
      <PageHero label="后台管理" title="人工维护入口">
        第一阶段先提供管理员录入界面原型，支持人员、赛事、荣誉和人员赛事关联的本地草稿维护。接入 Supabase 后可替换为真实登录和数据库保存。
      </PageHero>
      <AdminConsole />
    </>
  );
}
