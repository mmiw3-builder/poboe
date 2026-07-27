import type { Metadata } from "next";
import LoginGate from "@/components/auth/LoginGate";
import AccountPanel from "@/components/space/AccountPanel";
import { getDictionary, getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.account.title };
}

export default function AccountPage() {
  return (
    <main className="flex-1">
      <LoginGate>
        <AccountPanel />
      </LoginGate>
    </main>
  );
}
