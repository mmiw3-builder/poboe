"use client";

import Link from "next/link";
import { useState } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/client";
import { shortIdentity, useAuth } from "@/lib/client/auth";

const NAV_ITEMS = [
  { href: "/explore", key: "explore" },
  { href: "/create", key: "create" },
  { href: "/space", key: "mySpace" },
  { href: "/about", key: "about" },
] as const;

function UserChip() {
  const { t } = useI18n();
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) return null;
  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full border border-border px-4 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent"
      >
        {t.auth.signIn}
      </Link>
    );
  }
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="max-w-40 truncate rounded-full border border-accent/50 px-4 py-1.5 text-sm text-accent"
      >
        {shortIdentity(user)}
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-40 rounded-xl border border-border bg-background p-1 shadow-lg">
          <Link
            href="/space"
            className="block rounded-lg px-3 py-2 text-sm hover:bg-halo"
            onClick={() => setMenuOpen(false)}
          >
            {t.nav.mySpace}
          </Link>
          <Link
            href="/space/account"
            className="block rounded-lg px-3 py-2 text-sm hover:bg-halo"
            onClick={() => setMenuOpen(false)}
          >
            {t.account.title}
          </Link>
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-halo"
            onClick={() => {
              setMenuOpen(false);
              void logout();
            }}
          >
            {t.auth.signOut}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-serif text-xl font-semibold tracking-wide">
            永铭
          </span>
          <span className="font-serif text-sm uppercase tracking-[0.25em] text-muted">
            Evermark
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-foreground/80 transition-colors hover:text-accent"
            >
              {t.nav[item.key]}
            </Link>
          ))}
          <LanguageSwitcher />
          <UserChip />
        </nav>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center md:hidden"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            {open ? (
              <path d="M5 5l10 10M15 5L5 15" />
            ) : (
              <path d="M3 6h14M3 10h14M3 14h14" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-border px-4 py-3 md:hidden">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded px-2 py-2 text-sm hover:bg-halo"
                  onClick={() => setOpen(false)}
                >
                  {t.nav[item.key]}
                </Link>
              </li>
            ))}
            <li className="px-2 py-2">
              <LanguageSwitcher />
            </li>
            <li className="px-2 py-2">
              <UserChip />
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
