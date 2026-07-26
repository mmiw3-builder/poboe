"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";

export interface TributeMessage {
  name?: string;
  message: string;
  createdAt: number;
}

interface Counts {
  flower: number;
  candle: number;
  message: number;
}

/**
 * Visitor tributes: flowers, candles and permanent messages.
 * New tributes are appended optimistically — chain indexing takes a moment,
 * so a refresh would not show them immediately anyway.
 */
export default function Tributes({
  memorialId,
  enabled,
  initialCounts,
  initialMessages,
}: {
  memorialId: string;
  enabled: boolean;
  initialCounts: Counts;
  initialMessages: TributeMessage[];
}) {
  const { t, locale } = useI18n();
  const [counts, setCounts] = useState(initialCounts);
  const [messages, setMessages] = useState(initialMessages);
  const [busy, setBusy] = useState<"flower" | "candle" | "message" | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function send(kind: "flower" | "candle" | "message") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch("/api/tribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memorialId,
          kind,
          message: kind === "message" ? message.trim() : undefined,
          name: name.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { error?: { code: string } };
      if (!res.ok) {
        setError(
          json.error?.code === "content_rejected"
            ? t.tributes.rejected
            : t.tributes.failed,
        );
        return;
      }
      setCounts((c) => ({ ...c, [kind]: c[kind] + 1 }));
      if (kind === "message") {
        setMessages((m) => [
          { name: name.trim() || undefined, message: message.trim(), createdAt: Date.now() },
          ...m,
        ]);
        setMessage("");
        setFormOpen(false);
      }
      setFlash(t.tributes.thanks);
      setTimeout(() => setFlash(null), 2500);
    } catch {
      setError(t.tributes.failed);
    } finally {
      setBusy(null);
    }
  }

  if (!enabled) {
    return (
      <section className="mx-auto w-full max-w-3xl px-4 py-10 text-center text-sm text-muted sm:px-6">
        {t.tributes.disabled}
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h2 className="mb-6 text-center font-serif text-2xl font-semibold">
        {t.tributes.title}
      </h2>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void send("flower")}
          className="btn-outline gap-2"
        >
          <span aria-hidden>🌸</span>
          {t.tributes.flower}
          <span className="text-muted">{counts.flower}</span>
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void send("candle")}
          className="btn-outline gap-2"
        >
          <span aria-hidden>🕯️</span>
          {t.tributes.candle}
          <span className="text-muted">{counts.candle}</span>
        </button>
        <button
          type="button"
          className="btn-primary gap-2"
          onClick={() => setFormOpen((v) => !v)}
        >
          {t.tributes.leaveMessage}
        </button>
      </div>

      {flash && (
        <p className="mt-4 text-center text-sm text-accent">{flash}</p>
      )}
      {error && (
        <p className="mt-4 text-center text-sm text-red-500">{error}</p>
      )}

      {formOpen && (
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-border bg-surface p-5">
          <input
            className="input"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.tributes.namePlaceholder}
          />
          <textarea
            className="input mt-3 min-h-28"
            value={message}
            maxLength={1000}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.tributes.messagePlaceholder}
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="btn-primary !h-9 !px-5 text-xs"
              disabled={busy !== null || !message.trim()}
              onClick={() => void send("message")}
            >
              {busy === "message" ? t.tributes.sending : t.tributes.submit}
            </button>
          </div>
        </div>
      )}

      <div className="mt-10 space-y-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted">{t.tributes.empty}</p>
        ) : (
          messages.map((m, i) => (
            <blockquote
              key={i}
              className="rounded-xl border border-border bg-surface px-5 py-4"
            >
              <p className="text-[15px] leading-7 text-foreground/90">
                {m.message}
              </p>
              <footer className="mt-2 text-xs text-muted">
                — {m.name || t.tributes.anonymous} ·{" "}
                {new Date(m.createdAt).toLocaleDateString(
                  locale === "zh" ? "zh-CN" : "en-US",
                )}
              </footer>
            </blockquote>
          ))
        )}
      </div>
    </section>
  );
}
