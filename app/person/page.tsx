import { PageHero } from "@/components/page-hero";
import { PersonSearchClient } from "./person-search-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "选手查询",
  description: "通过WCA ID或姓名查询魔方选手的详细成绩与排名数据"
};

export default function PersonSearchPage() {
  return (
    <>
      <PageHero label="选手" title="选手查询">
        通过 WCA ID 或姓名搜索辽宁选手库中的魔方选手，查看详细成绩、排名与参赛记录
      </PageHero>
      <section className="person-search-section">
        <PersonSearchClient />
      </section>
    </>
  );
}
