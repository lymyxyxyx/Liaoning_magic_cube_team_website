import { PageHero } from "@/components/page-hero";
import { AccountBookConsole } from "./account-book-console";
import Link from "next/link";

export default function AdminAccountsPage() {
  return (
    <>
      <PageHero
        label="后台管理"
        title="赛事账本"
        actions={
          <Link className="button" href="/admin">
            返回人员库
          </Link>
        }
      >
        汇总单场比赛收入、支出、分类小计和结余。
      </PageHero>
      <AccountBookConsole />
    </>
  );
}
