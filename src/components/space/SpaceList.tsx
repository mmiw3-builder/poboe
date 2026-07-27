"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { formatUsd } from "@/lib/billing/engine";
import { useAuth } from "@/lib/client/auth";
import { importKey, listKeys } from "@/lib/client/keystore";
import { custodyKey, listAccountSpaces } from "@/lib/client/keysync";

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

interface SpaceRow {
  memorialId: string;
  name: string;
  createdAt: number;
}

/** Spaces owned by this account, merged with any keys in this browser. */
export default function SpaceList() {
  const { t, locale } = useI18n();
  const [spaces, setSpaces] = useState<SpaceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function mergeAndSet(cancelledRef?: { current: boolean }) {
    const local = listKeys();
    void listAccountSpaces().then((account) => {
      if (cancelledRef?.current) return;
      const map = new Map<string, SpaceRow>();
      for (const s of account) {
        map.set(s.memorialId, {
          memorialId: s.memorialId,
          name: s.name,
          createdAt: s.createdAt,
        });
      }
      for (const k of local) {
        if (!map.has(k.memorialId)) {
          map.set(k.memorialId, {
            memorialId: k.memorialId,
            name: k.name,
            createdAt: k.createdAt,
          });
        }
      }
      setSpaces(
        [...map.values()].sort((a, b) => b.createdAt - a.createdAt),
      );
    });
  }

  useEffect(() => {
    const cancelled = { current: false };
    // Deferred: localStorage + account fetch happen after hydration.
    queueMicrotask(() => mergeAndSet(cancelled));
    return () => {
      cancelled.current = true;
    };
  }, []);

  function handleImport(file: File) {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const key = importKey(String(reader.result));
        // Imported keys join the account custody too (best-effort).
        void custodyKey(key).finally(() => mergeAndSet());
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
      </div>

      <BalanceCard />

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link href="/create" className="btn-primary">
          {t.space.createNew}
        </Link>
        <Link href="/space/watch" className="btn-outline">
          {t.watch.spaceLink}
        </Link>
      </div>
      {error && (
        <p className="mt-4 text-center text-sm text-red-500">{error}</p>
      )}

      <div className="mt-10 space-y-4">
        {spaces === null ? null : spaces.length === 0 ? (
          <p className="text-center text-sm text-muted">{t.space.empty}</p>
        ) : (
          spaces.map((space) => (
            <div
              key={space.memorialId}
              className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-border bg-surface px-6 py-5 sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-serif text-lg font-semibold">
                  {space.name || space.memorialId}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(space.createdAt).toLocaleDateString(
                    locale === "zh" ? "zh-CN" : "en-US",
                  )}{" "}
                  · {space.memorialId}
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href={`/m/${space.memorialId}`}
                  className="btn-outline !h-9 !px-4 text-xs"
                >
                  {t.space.view}
                </Link>
                <Link
                  href={`/space/edit/${space.memorialId}`}
                  className="btn-primary !h-9 !px-4 text-xs"
                >
                  {t.space.edit}
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      <details className="mx-auto mt-12 max-w-md rounded-xl border border-border bg-surface px-5 py-4">
        <summary className="cursor-pointer text-sm text-muted">
          {t.space.advanced}
        </summary>
        <p className="mt-3 text-xs leading-5 text-muted">
          {t.space.keyLocalNote}
        </p>
        <button
          type="button"
          className="btn-outline mt-4 !h-9 !px-4 text-xs"
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
      </details>
    </div>
  );
}
