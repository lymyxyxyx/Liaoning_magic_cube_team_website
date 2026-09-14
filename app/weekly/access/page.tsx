import { redirect } from "next/navigation";

/** Legacy invite URL: weekly results are now public. */
export default function WeeklyAccessPage() {
  redirect("/weekly");
}
