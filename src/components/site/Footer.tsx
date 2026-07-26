"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center sm:px-6">
        <p className="font-serif text-lg">
          永铭 <span className="text-muted">·</span>{" "}
          <span className="uppercase tracking-[0.25em] text-muted">
            Evermark
          </span>
        </p>
        <p className="max-w-md text-sm text-muted">{t.footer.poweredBy}</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted">
          <Link className="hover:text-accent" href="/about">
            {t.footer.about}
          </Link>
          <Link className="hover:text-accent" href="/about#faq">
            {t.footer.faq}
          </Link>
          <Link className="hover:text-accent" href="/permanence">
            {t.footer.permanence}
          </Link>
          <Link className="hover:text-accent" href="/about#terms">
            {t.footer.terms}
          </Link>
          <Link className="hover:text-accent" href="/about#report">
            {t.footer.report}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
