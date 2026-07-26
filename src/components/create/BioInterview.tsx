"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";

/**
 * Guided-interview drafting: a few gentle questions whose answers are woven
 * into a life-story draft (AI-assisted server-side, template fallback).
 */
export default function BioInterview({
  name,
  hasExistingBio,
  onDraft,
}: {
  name: string;
  hasExistingBio: boolean;
  onDraft: (bio: string) => void;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const questionKeys = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generate() {
    const filled = questionKeys
      .map((k) => ({
        question: t.create.interview.questions[k],
        answer: (answers[k] ?? "").trim(),
      }))
      .filter((a) => a.answer);
    if (filled.length === 0) {
      setMessage(t.create.interview.needOne);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/compose-bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "TA",
          lang: locale,
          answers: filled,
        }),
      });
      const json = (await res.json()) as { data?: { bio: string } };
      if (!res.ok || !json.data?.bio) throw new Error("failed");
      onDraft(json.data.bio);
      setMessage(t.create.interview.applied);
      setOpen(false);
    } catch {
      setMessage(t.create.interview.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        className="text-sm text-accent underline-offset-4 hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        ✦ {t.create.interview.open}
      </button>
      {message && !open && (
        <p className="mt-1 text-xs text-accent">{message}</p>
      )}

      {open && (
        <div className="mt-3 rounded-xl border border-accent/40 bg-surface p-5">
          <h3 className="font-serif text-lg font-semibold">
            {t.create.interview.title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            {t.create.interview.intro}
          </p>
          <div className="mt-4 space-y-4">
            {questionKeys.map((k) => (
              <label key={k} className="block">
                <span className="mb-1 block text-sm">
                  {t.create.interview.questions[k]}
                </span>
                <textarea
                  className="input min-h-16"
                  maxLength={2000}
                  value={answers[k] ?? ""}
                  placeholder={t.create.interview.answerPlaceholder}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [k]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          {hasExistingBio && (
            <p className="mt-3 text-xs text-muted">
              {t.create.interview.replaceWarning}
            </p>
          )}
          {message && <p className="mt-3 text-xs text-red-500">{message}</p>}
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              className="btn-outline !h-9 !px-4 text-xs"
              onClick={() => setOpen(false)}
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              className="btn-primary !h-9 !px-4 text-xs"
              disabled={busy}
              onClick={() => void generate()}
            >
              {busy ? t.create.interview.generating : t.create.interview.generate}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
