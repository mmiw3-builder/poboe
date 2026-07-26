"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";

export interface ApprovedMemory {
  name?: string;
  relation?: string;
  story: string;
  createdAt: number;
}

/**
 * "Memories from family & friends": approved contributions plus a form for
 * visitors to submit their own fragment (pending the owner's confirmation).
 */
export default function ContributedMemories({
  memorialId,
  approved,
}: {
  memorialId: string;
  approved: ApprovedMemory[];
}) {
  const { t, locale } = useI18n();
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [story, setStory] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!story.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/contribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memorialId,
          name: name.trim() || undefined,
          relation: relation.trim() || undefined,
          story: story.trim(),
        }),
      });
      const json = (await res.json()) as { error?: { code: string } };
      if (!res.ok) {
        setMessage(
          json.error?.code === "content_rejected"
            ? t.contributions.rejected
            : t.contributions.failed,
        );
        return;
      }
      setStory("");
      setFormOpen(false);
      setMessage(t.contributions.thanks);
    } catch {
      setMessage(t.contributions.failed);
    } finally {
      setBusy(false);
    }
  }

  if (approved.length === 0 && !formOpen && !message) {
    // Quiet entry point when nothing is displayed yet.
    return (
      <section className="mx-auto w-full max-w-3xl px-4 pb-4 text-center sm:px-6">
        <button
          type="button"
          className="text-sm text-muted underline-offset-4 hover:text-accent hover:underline"
          onClick={() => setFormOpen(true)}
        >
          {t.contributions.submitOpen}
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h2 className="mb-2 text-center font-serif text-2xl font-semibold">
        {t.contributions.title}
      </h2>
      <p className="mx-auto mb-6 max-w-md text-center text-xs leading-5 text-muted">
        {t.contributions.intro}
      </p>

      {approved.length > 0 && (
        <div className="space-y-4">
          {approved.map((m, i) => (
            <blockquote
              key={i}
              className="rounded-xl border-l-2 border-accent/60 bg-surface px-5 py-4"
            >
              <p className="text-[15px] leading-7 text-foreground/90">
                {m.story}
              </p>
              <footer className="mt-2 text-xs text-muted">
                — {m.name || t.contributions.anonymous}
                {m.relation ? ` · ${m.relation}` : ""} ·{" "}
                {new Date(m.createdAt).toLocaleDateString(
                  locale === "zh" ? "zh-CN" : "en-US",
                )}
              </footer>
            </blockquote>
          ))}
        </div>
      )}

      {message && (
        <p className="mt-4 text-center text-sm text-accent">{message}</p>
      )}

      {formOpen ? (
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-border bg-surface p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="input"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.contributions.namePlaceholder}
            />
            <input
              className="input"
              value={relation}
              maxLength={60}
              onChange={(e) => setRelation(e.target.value)}
              placeholder={t.contributions.relationPlaceholder}
            />
          </div>
          <textarea
            className="input mt-3 min-h-32"
            value={story}
            maxLength={2000}
            onChange={(e) => setStory(e.target.value)}
            placeholder={t.contributions.storyPlaceholder}
          />
          <div className="mt-3 flex justify-end gap-3">
            <button
              type="button"
              className="btn-outline !h-9 !px-4 text-xs"
              onClick={() => setFormOpen(false)}
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              className="btn-primary !h-9 !px-4 text-xs"
              disabled={busy || !story.trim()}
              onClick={() => void submit()}
            >
              {busy ? t.contributions.sending : t.contributions.submit}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 text-center">
          <button
            type="button"
            className="btn-outline !h-9 !px-5 text-xs"
            onClick={() => setFormOpen(true)}
          >
            {t.contributions.submitOpen}
          </button>
        </div>
      )}
    </section>
  );
}
