import type { Metadata } from "next";
import { Suspense } from "react";
import LoginGate from "@/components/auth/LoginGate";
import RechargePanel from "@/components/space/RechargePanel";
import { getDictionary, getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.recharge.title };
}

export default function RechargePage() {
  return (
    <main className="flex-1">
      <LoginGate>
        <Suspense>
          <RechargePanel />
        </Suspense>
      </LoginGate>
    </main>
  );
}
