"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { Contribution } from "@/lib/memorial/schema";

interface Item {
  contribution: Contribution;
  txId: string;
}

/**
 * Edit-mode panel: the owner ticks which visitor contributions to display.
 * The chosen txIds ride into the next signed manifest version.
 */
export default function ContributionReview({
  memorialId,
  approved,
  onChange,
}: {
  memorialId: string;
  approved: string[];
  onChange: (txIds: string[]) => void;
}) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void fetch(`/api/contribution?memorialId=${encodeURIComponent(memorialId)}`)
        .then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          const json = (await res.json()) as { data?: { items: Item[] } };
          if (!cancelled) setItems(json.data?.items ?? []);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [memorialId]);

  function toggle(txId: string) {
    const set = new Set(approved);
    if (set.has(txId)) set.delete(txId);
    else set.add(txId);
    onChange([...set]);
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted">{t.contributions.review.hint}</p>
      {failed ? (
        <p className="text-sm text-muted">{t.common.error}</p>
      ) : items === null ? (
        <p className="text-sm text-muted">{t.contributions.review.loading}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">{t.contributions.review.empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map(({ contribution, txId }) => (
            <label
              key={txId}
              className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[var(--accent)]"
                checked={approved.includes(txId)}
                onChange={() => toggle(txId)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-6 text-foreground/90">
                  {contribution.story}
                </span>
                <span className="mt-1 block text-xs text-muted">
                  — {contribution.name || t.contributions.anonymous}
                  {contribution.relation ? ` · ${contribution.relation}` : ""} ·{" "}
                  {new Date(contribution.createdAt).toLocaleDateString(
                    locale === "zh" ? "zh-CN" : "en-US",
                  )}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
