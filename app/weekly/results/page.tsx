import { redirect } from "next/navigation";

/** Legacy entry URL: keep old bookmarks working without rendering an input UI. */
export default function WeeklyResultsEntryPage() {
  redirect("/weekly");
}
