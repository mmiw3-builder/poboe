import type { Metadata } from "next";
import WatchConfirm from "@/components/watch/WatchConfirm";
import { getDictionary, getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.watch.confirm.title, robots: { index: false } };
}

export default async function WatchConfirmPage(
  props: PageProps<"/watch/confirm">,
) {
  const params = await props.searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return (
    <main className="flex-1">
      <WatchConfirm token={token} />
    </main>
  );
}
