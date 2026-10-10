import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AdminWeeklyPlayerImportPage() {
  redirect("/admin/weekly/players");
}
