"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";

/** Trusted-contact confirmation: one grave, deliberate button. */
export default function WatchConfirm({ token }: { token: string }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<"idle" | "busy" | "done" | "invalid">(
    token ? "idle" : "invalid",
  );

  async function confirm() {
    setPhase("busy");
    try {
      const res = await fetch("/api/watch/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setPhase(res.ok ? "done" : "invalid");
    } catch {
      setPhase("invalid");
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-20 text-center sm:px-6">
      <div className="halo pt-16">
        <p className="text-4xl">🕯️</p>
        <h1 className="mt-6 font-serif text-3xl font-semibold">
          {t.watch.confirm.title}
        </h1>
      </div>

      {phase === "done" ? (
        <p className="mt-8 rounded-xl border border-accent/40 bg-halo px-5 py-4 text-sm leading-6 text-accent-strong">
          {t.watch.confirm.done}
        </p>
      ) : phase === "invalid" ? (
        <p className="mt-8 rounded-xl border border-border bg-surface px-5 py-4 text-sm leading-6 text-muted">
          {t.watch.confirm.invalid}
        </p>
      ) : (
        <>
          <p className="mt-6 text-left text-sm leading-7 text-foreground/85">
            {t.watch.confirm.body}
          </p>
          <p className="mt-4 rounded-lg border border-accent/40 bg-halo px-4 py-3 text-xs leading-5 text-accent-strong">
            {t.watch.confirm.warning}
          </p>
          <button
            type="button"
            className="btn-primary mt-8 w-full"
            disabled={phase === "busy"}
            onClick={() => void confirm()}
          >
            {phase === "busy"
              ? t.watch.confirm.confirming
              : t.watch.confirm.button}
          </button>
        </>
      )}
    </div>
  );
}
