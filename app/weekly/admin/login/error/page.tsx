import { redirect } from "next/navigation";

export default function WeeklyLoginErrorPage() {
  redirect("/admin/login/error");
}
