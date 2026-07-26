"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { formatUsd } from "@/lib/billing/engine";
import { useAuth } from "@/lib/client/auth";
import { importKey, listKeys, type StoredKey } from "@/lib/client/keystore";

function BalanceCard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    queueMicrotask(() => {
      void fetch("/api/billing")
        .then(async (res) => {
          const json = (await res.json()) as {
            data?: { balanceMicroUsd: number };
          };
          if (!cancelled && json.data) setBalance(json.data.balanceMicroUsd);
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || balance === null) return null;
  return (
    <div className="mx-auto mt-8 flex max-w-md items-center justify-between rounded-2xl border border-border bg-surface px-6 py-4">
      <div>
        <p className="text-xs text-muted">{t.billing.balance}</p>
        <p className="font-serif text-2xl text-accent">{formatUsd(balance)}</p>
      </div>
      <Link href="/space/recharge" className="btn-outline !h-9 !px-4 text-xs">
        {t.billing.recharge}
      </Link>
    </div>
  );
}

/** Memorials owned by keys in this browser's keystore. */
export default function SpaceList() {
  const { t, locale } = useI18n();
  const [keys, setKeys] = useState<StoredKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    // Deferred: localStorage is read after hydration to keep SSR output stable.
    queueMicrotask(() => {
      if (!cancelled) setKeys(listKeys());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleImport(file: File) {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importKey(String(reader.result));
        setKeys(listKeys());
      } catch {
        setError(t.space.importInvalid);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 sm:px-6">
      <div className="halo pt-16 text-center">
        <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
          {t.space.title}
        </h1>
        <p className="mt-3 text-sm text-muted">{t.space.subtitle}</p>
        <p className="mx-auto mt-4 max-w-md text-xs leading-5 text-muted/80">
          {t.space.keyLocalNote}
        </p>
      </div>

      <BalanceCard />

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link href="/create" className="btn-primary">
          {t.space.createNew}
        </Link>
        <button
          type="button"
          className="btn-outline"
          onClick={() => fileInput.current?.click()}
        >
          {t.space.importKey}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="mt-4 text-center text-sm text-red-500">{error}</p>
      )}

      <div className="mt-10 space-y-4">
        {keys === null ? null : keys.length === 0 ? (
          <p className="text-center text-sm text-muted">{t.space.empty}</p>
        ) : (
          keys.map((key) => (
            <div
              key={key.memorialId}
              className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-border bg-surface px-6 py-5 sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-serif text-lg font-semibold">
                  {key.name || key.memorialId}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(key.createdAt).toLocaleDateString(
                    locale === "zh" ? "zh-CN" : "en-US",
                  )}{" "}
                  · {key.memorialId}
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href={`/m/${key.memorialId}`}
                  className="btn-outline !h-9 !px-4 text-xs"
                >
                  {t.space.view}
                </Link>
                <Link
                  href={`/space/edit/${key.memorialId}`}
                  className="btn-primary !h-9 !px-4 text-xs"
                >
                  {t.space.edit}
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
