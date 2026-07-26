"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { gatewayUrlFor } from "@/lib/irys/config";
import { deriveMemorialId, verifyManifest } from "@/lib/memorial/identity";
import type { MemorialManifest } from "@/lib/memorial/schema";

interface VerifyResult {
  manifest: MemorialManifest;
  txId: string;
  idOk: boolean;
  sigOk: boolean;
}

/**
 * Trustless verification, run in the visitor's own browser: the manifest
 * is fetched, the id re-derived from the owner's public key, and the
 * signature checked locally — the server's word is never taken for it.
 */
export default function PermanenceVerifier({
  initialId,
}: {
  initialId?: string;
}) {
  const { t } = useI18n();
  const [id, setId] = useState(initialId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);

  async function verify() {
    const trimmed = id.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/memorial?id=${encodeURIComponent(trimmed)}`,
      );
      if (!res.ok) {
        setError(t.permanence.verify.notFound);
        return;
      }
      const json = (await res.json()) as {
        data?: { manifest: MemorialManifest; txId: string };
      };
      if (!json.data) {
        setError(t.permanence.verify.notFound);
        return;
      }
      const { manifest, txId } = json.data;
      const idOk =
        deriveMemorialId(manifest.ownerPubKey, manifest.nonce) === manifest.id &&
        manifest.id === trimmed;
      const sigOk = verifyManifest(manifest);
      setResult({ manifest, txId, idOk, sigOk });
    } catch {
      setError(t.permanence.verify.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="font-serif text-xl font-semibold">
        {t.permanence.verify.title}
      </h2>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          className="input flex-1"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder={t.permanence.verify.placeholder}
          maxLength={40}
          onKeyDown={(e) => {
            if (e.key === "Enter") void verify();
          }}
        />
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !id.trim()}
          onClick={() => void verify()}
        >
          {busy ? t.permanence.verify.checking : t.permanence.verify.button}
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {result && (
        <div className="mt-6 space-y-3 text-sm">
          <Check ok={result.idOk} label={t.permanence.verify.idCheck} />
          <Check ok={result.sigOk} label={t.permanence.verify.sigCheck} />
          {!result.idOk || !result.sigOk ? (
            <p className="text-red-500">{t.permanence.verify.failed}</p>
          ) : (
            <div className="mt-4 space-y-2 rounded-xl border border-border bg-background p-4 text-xs">
              <Row
                label={t.permanence.verify.version}
                value={`v${result.manifest.version} · ${result.manifest.subject.name}`}
              />
              <Row
                label={t.permanence.verify.owner}
                value={result.manifest.ownerPubKey}
                mono
              />
              <Row
                label={t.permanence.verify.txId}
                value={result.txId}
                mono
              />
              <div className="flex flex-wrap gap-4 pt-2">
                <a
                  href={gatewayUrlFor(result.txId)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  {t.permanence.verify.viewRaw} ↗
                </a>
                <a
                  href={`/api/export/${result.manifest.id}`}
                  className="text-accent underline-offset-4 hover:underline"
                >
                  {t.permanence.verify.export} ↓
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className={`flex items-center gap-2 ${ok ? "" : "text-red-500"}`}>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
          ok
            ? "bg-life/15 text-life"
            : "bg-red-500/10 text-red-500"
        }`}
        aria-hidden
      >
        {ok ? "✓" : "✕"}
      </span>
      {label}
    </p>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <span className="shrink-0 text-muted">{label}</span>
      <span className={`break-all ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
