"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { useAuth } from "@/lib/client/auth";

interface EthereumProvider {
  request: (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export default function LoginPanel() {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/space";

  const [tab, setTab] = useState<"email" | "wallet">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"enter" | "code">("enter");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function done() {
    await refresh();
    router.replace(next);
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/auth/email/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = (await res.json()) as {
        data?: { sent: boolean; devCode?: string };
      };
      if (!res.ok) throw new Error("failed");
      setStage("code");
      if (json.data?.devCode) {
        setCode(json.data.devCode);
        setNote(t.auth.devCodeNote);
      } else {
        setNote(t.auth.codeSent);
      }
    } catch {
      setError(t.auth.failed);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      if (!res.ok) throw new Error("failed");
      await done();
    } catch {
      setError(t.auth.failed);
      setBusy(false);
    }
  }

  async function walletLogin() {
    setError(null);
    const eth = window.ethereum;
    if (!eth) {
      setError(t.auth.noWallet);
      return;
    }
    setBusy(true);
    setNote(t.auth.walletSigning);
    try {
      const accounts = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[];
      const address = accounts[0];
      if (!address) throw new Error("no account");

      const nonceRes = await fetch("/api/auth/wallet/nonce");
      const nonceJson = (await nonceRes.json()) as {
        data?: { id: string; nonce: string; message: string };
      };
      if (!nonceJson.data) throw new Error("nonce failed");

      const signature = (await eth.request({
        method: "personal_sign",
        params: [nonceJson.data.message, address],
      })) as string;

      const res = await fetch("/api/auth/wallet/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonceId: nonceJson.data.id,
          nonce: nonceJson.data.nonce,
          address,
          signature,
        }),
      });
      if (!res.ok) throw new Error("verify failed");
      await done();
    } catch {
      setError(t.auth.failed);
      setBusy(false);
      setNote(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-20 sm:px-6">
      <div className="halo pt-16 text-center">
        <h1 className="font-serif text-3xl font-semibold">{t.auth.title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted">
          {t.auth.intro}
        </p>
      </div>

      <div className="mt-8 flex rounded-full border border-border p-1">
        {(
          [
            ["email", t.auth.emailTab],
            ["wallet", t.auth.walletTab],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-full py-2 text-sm transition-colors ${
              tab === key
                ? "bg-accent text-accent-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
        {tab === "email" ? (
          <div className="space-y-4">
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.auth.emailPlaceholder}
              disabled={stage === "code"}
            />
            {stage === "code" && (
              <input
                type="text"
                inputMode="numeric"
                className="input text-center tracking-[0.5em]"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder={t.auth.codePlaceholder}
              />
            )}
            {note && <p className="text-xs text-accent">{note}</p>}
            {stage === "enter" ? (
              <button
                type="button"
                className="btn-primary w-full"
                disabled={busy || !email.includes("@")}
                onClick={() => void sendCode()}
              >
                {busy ? t.auth.sending : t.auth.sendCode}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary w-full"
                disabled={busy || code.length !== 6}
                onClick={() => void verifyCode()}
              >
                {busy ? t.auth.verifying : t.auth.verify}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {note && <p className="text-xs text-accent">{note}</p>}
            <button
              type="button"
              className="btn-primary w-full"
              disabled={busy}
              onClick={() => void walletLogin()}
            >
              {t.auth.walletConnect}
            </button>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
