import { redirect } from "next/navigation";

export default async function NewPropertyRedirect({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name: rawName } = await searchParams;
  const name = rawName?.trim();
  const qs = name ? `?tab=properties&name=${encodeURIComponent(name)}` : "?tab=properties";
  redirect(`/stats${qs}`);
}
