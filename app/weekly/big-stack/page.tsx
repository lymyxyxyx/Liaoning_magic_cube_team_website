import { notFound } from "next/navigation";

export default function WeeklyBigStackPage() {
  // Keep the records available to the weekly admin tools, but do not expose a
  // public page for them.
  notFound();
}
