import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function WeeklyResultsImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/weekly/${encodeURIComponent(id)}/results`);
}
