import type { Metadata } from "next";
import { MeituanRankingsClient } from "./meituan-rankings-client";

export const metadata: Metadata = {
  title: "美团魔方排名",
  robots: {
    index: false,
    follow: false
  }
};

export default function MeituanRankingsPage() {
  return <MeituanRankingsClient />;
}
