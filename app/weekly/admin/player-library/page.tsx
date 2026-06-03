import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function WeeklyPlayerLibraryPage() {
  redirect("/admin/weekly-player-library");
}
