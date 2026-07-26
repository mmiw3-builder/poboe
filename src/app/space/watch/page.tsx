import type { Metadata } from "next";
import LoginGate from "@/components/auth/LoginGate";
import WatchPanel from "@/components/space/WatchPanel";
import { getDictionary, getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.watch.title };
}

export default function WatchPage() {
  return (
    <main className="flex-1">
      <LoginGate>
        <WatchPanel />
      </LoginGate>
    </main>
  );
}
