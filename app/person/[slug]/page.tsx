import { redirect } from "next/navigation";

export default function PersonAliasPage({ params }: { params: { slug: string } }) {
  redirect(`/people/${params.slug}`);
}
