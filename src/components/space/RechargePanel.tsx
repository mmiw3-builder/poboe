"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { PRICE_PER_MB_MICRO_USD, formatUsd } from "@/lib/billing/engine";

const TIERS = [5, 20, 100];
const PHOTO_MB = 2;

function photosFor(amountUsd: number): number {
  const mb = (amountUsd * 1_000_000) / PRICE_PER_MB_MICRO_USD;
  return Math.floor(mb / PHOTO_MB);
}

export default function RechargePanel() {
  const { t } = useI18n();
  const params = useSearchParams();
  const status = params.get("status");

  const [selected, setSelected] = useState<number | "custom">(20);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const loadBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/billing");
      const json = (await res.json()) as {
        data?: { balanceMicroUsd: number };
      };
      if (json.data) setBalance(json.data.balanceMicroUsd);
    } catch {
      /* non-blocking */
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadBalance());
  }, [loadBalance]);

  useEffect(() => {
    let cancelled = false;
    // Deferred: read of the redirect status is applied after hydration.
    queueMicrotask(() => {
      if (cancelled) return;
      if (status === "success") setMessage(t.recharge.success);
      else if (status === "cancelled") setMessage(t.recharge.cancelled);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const amount =
    selected === "custom" ? Math.floor(Number(custom) || 0) : selected;

  async function pay() {
    if (amount < 5) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: amount }),
      });
      const json = (await res.json()) as {
        data?: { url?: string; simulated?: boolean };
      };
      if (!res.ok) throw new Error("failed");
      if (json.data?.url) {
        window.location.href = json.data.url;
        return;
      }
      if (json.data?.simulated) {
        setMessage(t.recharge.success);
        await loadBalance();
      }
    } catch {
      setMessage(t.recharge.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-20 sm:px-6">
      <div className="halo pt-16 text-center">
        <h1 className="font-serif text-3xl font-semibold">
          {t.recharge.title}
        </h1>
        <p className="mt-3 text-sm text-muted">{t.recharge.subtitle}</p>
        {balance !== null && (
          <p className="mt-4 text-sm">
            {t.recharge.currentBalance}:{" "}
            <span className="font-serif text-xl text-accent">
              {formatUsd(balance)}
            </span>
          </p>
        )}
      </div>

      {message && (
        <p className="mt-6 rounded-lg border border-accent/40 bg-halo px-4 py-3 text-center text-sm text-accent-strong">
          {message}
        </p>
      )}

      <div className="mt-8 grid grid-cols-3 gap-3">
        {TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => setSelected(tier)}
            className={`rounded-xl border py-5 text-center transition-colors ${
              selected === tier
                ? "border-accent bg-halo text-accent"
                : "border-border hover:border-accent/60"
            }`}
          >
            <span className="block font-serif text-2xl">${tier}</span>
            <span className="mt-1 block text-[10px] text-muted">
              ≈{photosFor(tier)} {t.recharge.estimatePhotos.split("（")[0]}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSelected("custom")}
        className={`mt-3 w-full rounded-xl border py-3 text-sm transition-colors ${
          selected === "custom"
            ? "border-accent bg-halo text-accent"
            : "border-border text-muted hover:border-accent/60"
        }`}
      >
        {t.recharge.custom}
      </button>
      {selected === "custom" && (
        <input
          type="number"
          min={5}
          className="input mt-3 text-center"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={t.recharge.customPlaceholder}
        />
      )}

      <div className="mt-6 rounded-xl border border-border bg-surface p-4 text-center text-xs text-muted">
        <p className="font-medium text-foreground/80">
          {t.recharge.estimateTitle}
        </p>
        <p className="mt-1">
          ${amount || 0} ≈ {photosFor(amount || 0)} {t.recharge.estimatePhotos}
        </p>
        <p className="mt-0.5">{t.recharge.estimateOr}</p>
      </div>

      <button
        type="button"
        className="btn-primary mt-6 w-full"
        disabled={busy || amount < 5}
        onClick={() => void pay()}
      >
        {busy ? t.recharge.paying : `${t.recharge.pay} — $${amount || 0}`}
      </button>
      <p className="mt-3 text-center text-[11px] text-muted/80">
        {t.billing.priceNote}
      </p>
    </div>
  );
}
