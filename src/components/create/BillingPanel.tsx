"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { formatUsd } from "@/lib/billing/engine";

interface QuoteData {
  costMicroUsd: number;
  freeBytesApplied: number;
  balanceMicroUsd: number;
  sufficient: boolean;
}

/**
 * Pre-publish billing disclosure: exact cost of this publish, free-allowance
 * coverage, current balance and post-publish balance.
 */
export default function BillingPanel({
  bytesEstimate,
  mediaCostMicroUsd,
  onSufficiency,
}: {
  bytesEstimate: number;
  mediaCostMicroUsd: number;
  onSufficiency: (sufficient: boolean) => void;
}) {
  const { t } = useI18n();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bytes: bytesEstimate }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { data?: QuoteData };
        if (!cancelled && json.data) {
          setQuote(json.data);
          onSufficiency(json.data.sufficient);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          // Don't block publishing on a quote hiccup; the server re-checks.
          onSufficiency(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bytesEstimate, onSufficiency]);

  if (failed) return null;
  if (!quote) {
    return (
      <p className="mt-6 text-center text-xs text-muted">{t.common.loading}</p>
    );
  }

  const freeCovered = quote.costMicroUsd === 0;

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface p-5 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted">{t.billing.thisPublish}</span>
        <span className="font-serif text-lg">
          {freeCovered ? t.billing.freeCovered : formatUsd(quote.costMicroUsd)}
        </span>
      </div>
      {mediaCostMicroUsd > 0 && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>{t.billing.mediaCharged}</span>
          <span>{formatUsd(mediaCostMicroUsd)}</span>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{t.billing.balance}</span>
        <span>{formatUsd(quote.balanceMicroUsd)}</span>
      </div>
      {!freeCovered && quote.sufficient && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>{t.billing.afterBalance}</span>
          <span>{formatUsd(quote.balanceMicroUsd - quote.costMicroUsd)}</span>
        </div>
      )}
      {!quote.sufficient && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-red-400/40 bg-red-500/5 px-3 py-2">
          <span className="text-xs text-red-500">{t.billing.insufficient}</span>
          <Link
            href="/space/recharge"
            className="text-xs text-accent underline-offset-4 hover:underline"
          >
            {t.billing.recharge} →
          </Link>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted/80">{t.billing.priceNote}</p>
    </div>
  );
}
