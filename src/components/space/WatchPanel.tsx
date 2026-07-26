"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { listKeys } from "@/lib/client/keystore";

interface WatchRow {
  memorialId: string;
  state: string | null;
  inactivityDays: number | null;
  contactEmail: string | null;
  coolingEndsAt: number | null;
}

const DEFAULT_CHOICES = [30, 90, 180, 365];

function WatchCard({
  row,
  name,
  choices,
}: {
  row: WatchRow;
  name?: string;
  choices: number[];
}) {
  const { t, locale } = useI18n();
  const initiallyEnabled =
    row.state !== null && row.state !== "disabled";
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [days, setDays] = useState(row.inactivityDays ?? 180);
  const [email, setEmail] = useState(row.contactEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const stateKey = (row.state ?? "none") as keyof typeof t.watch.states;
  const stateLabel = t.watch.states[stateKey] ?? t.watch.states.none;
  const transitioned = row.state === "transitioned";

  async function save() {
    if (enabled && !email.includes("@")) {
      setMessage(t.watch.invalidEmail);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memorialId: row.memorialId,
          enabled,
          inactivityDays: days,
          contactEmail: email.trim(),
        }),
      });
      if (!res.ok) throw new Error("failed");
      setMessage(t.watch.saved);
    } catch {
      setMessage(t.watch.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-serif text-lg font-semibold">
            {name || row.memorialId}
          </p>
          <p className="mt-0.5 text-xs text-muted">{row.memorialId}</p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs ${
            transitioned
              ? "border-accent/50 text-accent"
              : initiallyEnabled
                ? "border-life/50 text-life"
                : "border-border text-muted"
          }`}
        >
          {stateLabel}
        </span>
      </div>

      {row.state === "cooling" && row.coolingEndsAt && (
        <p className="mt-3 text-xs text-accent-strong">
          {t.watch.coolingUntil}{" "}
          {new Date(row.coolingEndsAt).toLocaleDateString(
            locale === "zh" ? "zh-CN" : "en-US",
          )}
        </p>
      )}

      {!transitioned && (
        <>
          <label className="mt-5 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-[var(--life)]"
            />
            {t.watch.enable}
          </label>

          {enabled && (
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">
                  {t.watch.inactivityLabel}
                </span>
                <div className="flex flex-wrap gap-2">
                  {choices.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(d)}
                      className={`rounded-full border px-4 py-1.5 text-xs transition-colors ${
                        days === d
                          ? "border-life bg-life/10 text-life"
                          : "border-border text-muted hover:border-life/60"
                      }`}
                    >
                      {d} {t.watch.daysUnit}
                    </button>
                  ))}
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">
                  {t.watch.contactLabel}
                </span>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.watch.contactPlaceholder}
                  maxLength={200}
                />
              </label>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              className="btn-primary !h-9 !px-5 text-xs"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? t.watch.saving : t.watch.save}
            </button>
            {message && <span className="text-xs text-accent">{message}</span>}
          </div>
        </>
      )}
    </div>
  );
}

export default function WatchPanel() {
  const { t } = useI18n();
  const [rows, setRows] = useState<WatchRow[] | null>(null);
  const [choices, setChoices] = useState<number[]>(DEFAULT_CHOICES);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    // Deferred: fetch + localStorage read happen after hydration.
    queueMicrotask(() => {
      const map: Record<string, string> = {};
      for (const key of listKeys()) {
        if (key.name) map[key.memorialId] = key.name;
      }
      if (!cancelled) setNames(map);
      void fetch("/api/watch")
        .then(async (res) => {
          const json = (await res.json()) as {
            data?: { items: WatchRow[]; choices: number[] };
          };
          if (cancelled || !json.data) return;
          setRows(json.data.items);
          if (json.data.choices?.length) setChoices([...json.data.choices]);
        })
        .catch(() => {
          if (!cancelled) setRows([]);
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-20 sm:px-6">
      <div className="halo pt-16 text-center">
        <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
          {t.watch.title}
        </h1>
        <p className="mt-3 text-sm text-muted">{t.watch.subtitle}</p>
        <p className="mx-auto mt-5 max-w-xl text-left text-xs leading-6 text-muted/90">
          {t.watch.intro}
        </p>
      </div>

      <div className="mt-10 space-y-4">
        {rows === null ? null : rows.length === 0 ? (
          <p className="text-center text-sm text-muted">{t.watch.empty}</p>
        ) : (
          rows.map((row) => (
            <WatchCard
              key={row.memorialId}
              row={row}
              name={names[row.memorialId]}
              choices={choices}
            />
          ))
        )}
      </div>

      <div className="mt-10 text-center">
        <Link href="/space" className="text-sm text-accent underline-offset-4 hover:underline">
          ← {t.space.title}
        </Link>
      </div>
    </div>
  );
}
