import type { Metadata } from "next";
import CreateFlow from "@/components/create/CreateFlow";
import { getDictionary, getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.create.title, description: t.create.intro };
}

export default function CreatePage() {
  return (
    <main className="flex-1">
      <CreateFlow />
    </main>
  );
}
