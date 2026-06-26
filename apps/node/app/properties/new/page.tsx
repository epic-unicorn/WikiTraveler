import { redirect } from "next/navigation";

export default function NewPropertyRedirect({
  searchParams,
}: {
  searchParams: { name?: string };
}) {
  const name = searchParams.name?.trim();
  const qs = name ? `?tab=properties&name=${encodeURIComponent(name)}` : "?tab=properties";
  redirect(`/stats${qs}`);
}
