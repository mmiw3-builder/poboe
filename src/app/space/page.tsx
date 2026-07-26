import type { Metadata } from "next";
import SpaceList from "@/components/space/SpaceList";
import { getDictionary, getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.space.title, description: t.space.subtitle };
}

export default function SpacePage() {
  return (
    <main className="flex-1">
      <SpaceList />
    </main>
  );
}
