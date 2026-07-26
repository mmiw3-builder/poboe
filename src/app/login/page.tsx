import type { Metadata } from "next";
import { Suspense } from "react";
import LoginPanel from "@/components/auth/LoginPanel";
import { getDictionary, getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.auth.title };
}

export default function LoginPage() {
  return (
    <main className="flex-1">
      <Suspense>
        <LoginPanel />
      </Suspense>
    </main>
  );
}
