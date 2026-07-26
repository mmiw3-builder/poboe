import type { Metadata } from "next";
import LoginGate from "@/components/auth/LoginGate";
import EditLoader from "@/components/space/EditLoader";
import { getDictionary, getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.space.editTitle };
}

export default async function EditPage(props: PageProps<"/space/edit/[id]">) {
  const { id } = await props.params;
  return (
    <main className="flex-1">
      <LoginGate>
        <EditLoader memorialId={id} />
      </LoginGate>
    </main>
  );
}
