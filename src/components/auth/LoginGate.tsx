"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { useAuth } from "@/lib/client/auth";

/** Wraps creator-side flows: renders children only when signed in. */
export default function LoginGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <p className="py-24 text-center text-sm text-muted">{t.common.loading}</p>
    );
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-serif text-2xl font-semibold">
          {t.auth.loginRequired}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">{t.auth.intro}</p>
        <Link
          href={`/login?next=${encodeURIComponent(pathname ?? "/")}`}
          className="btn-primary mt-8 inline-flex"
        >
          {t.auth.goLogin}
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
