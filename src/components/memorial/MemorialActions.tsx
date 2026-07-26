"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";

export interface ShareCardInfo {
  name: string;
  altName?: string;
  dates?: string;
  epitaph?: string;
  portraitUrl?: string;
}

/** Share / memorial-card / verify-on-chain / report bar under a memorial. */
export default function MemorialActions({
  memorialId,
  verifyUrl,
  card,
}: {
  memorialId: string;
  verifyUrl: string;
  card: ShareCardInfo;
}) {
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const [rendering, setRendering] = useState(false);

  async function downloadCard() {
    setRendering(true);
    try {
      const { renderShareCard } = await import("@/lib/client/shareCard");
      const blob = await renderShareCard({
        id: memorialId,
        name: card.name,
        altName: card.altName,
        dates: card.dates,
        epitaph: card.epitaph,
        portraitUrl: card.portraitUrl,
        url: window.location.href,
        locale,
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `evermark-${memorialId}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error("share card failed:", err);
    } finally {
      setRendering(false);
    }
  }
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reportState, setReportState] = useState<
    "idle" | "sending" | "done" | "error"
  >("idle");

  async function submitReport() {
    if (!reason.trim()) return;
    setReportState("sending");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "memorial",
          targetId: memorialId,
          reason: reason.trim(),
        }),
      });
      if (!res.ok) throw new Error("failed");
      setReportState("done");
    } catch {
      setReportState("error");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border py-6 text-sm text-muted">
        <button
          type="button"
          className="hover:text-accent"
          onClick={() => {
            void navigator.clipboard
              .writeText(window.location.href)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
          }}
        >
          {copied ? t.common.copied : t.memorial.share}
        </button>
        <button
          type="button"
          className="hover:text-accent"
          disabled={rendering}
          onClick={() => void downloadCard()}
        >
          {rendering ? t.memorial.shareCardBusy : t.memorial.shareCard}
        </button>
        <a
          href={verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-accent"
        >
          {t.memorial.verify} ↗
        </a>
        <button
          type="button"
          className="hover:text-accent"
          onClick={() => setReportOpen((v) => !v)}
        >
          {t.report.button}
        </button>
      </div>
      <p className="pb-6 text-center text-xs text-muted/80">
        {t.memorial.permanenceNote}
      </p>

      {reportOpen && (
        <div className="mx-auto mb-10 max-w-md rounded-xl border border-border bg-surface p-5">
          <h3 className="font-serif text-lg font-semibold">{t.report.title}</h3>
          <p className="mt-2 text-xs leading-5 text-muted">{t.report.body}</p>
          {reportState === "done" ? (
            <p className="mt-4 text-sm text-accent">{t.report.thanks}</p>
          ) : (
            <>
              <textarea
                className="input mt-4 min-h-24"
                value={reason}
                maxLength={1000}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t.report.reasonPlaceholder}
              />
              {reportState === "error" && (
                <p className="mt-2 text-xs text-red-500">{t.report.failed}</p>
              )}
              <div className="mt-3 flex justify-end gap-3">
                <button
                  type="button"
                  className="btn-outline !h-9 !px-4 text-xs"
                  onClick={() => setReportOpen(false)}
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  className="btn-primary !h-9 !px-4 text-xs"
                  disabled={reportState === "sending" || !reason.trim()}
                  onClick={() => void submitReport()}
                >
                  {reportState === "sending"
                    ? t.report.sending
                    : t.report.submit}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
