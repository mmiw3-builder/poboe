"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { useAuth } from "@/lib/client/auth";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

/**
 * Account settings: bind the second sign-in channel. With both an email
 * and a wallet on the account, losing either one no longer locks the user
 * out of their balance, custody and watch settings.
 */
export default function AccountPanel() {
  const { t } = useI18n();
  const { user, refresh } = useAuth();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"enter" | "code">("enter");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  function errorText(codeStr: string | undefined): string {
    return codeStr === "identity_in_use" ? t.account.inUse : t.account.failed;
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/auth/link/email/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = (await res.json()) as {
        data?: { devCode?: string };
        error?: { message: string };
      };
      if (!res.ok) throw new Error(json.error?.message);
      setStage("code");
      if (json.data?.devCode) {
        setCode(json.data.devCode);
        setNote(t.auth.devCodeNote);
      } else {
        setNote(t.auth.codeSent);
      }
    } catch (err) {
      setError(errorText(err instanceof Error ? err.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/link/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const json = (await res.json()) as { error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message);
      setNote(t.account.bound);
      setStage("enter");
      setEmail("");
      setCode("");
      await refresh();
    } catch (err) {
      setError(errorText(err instanceof Error ? err.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  async function bindWallet() {
    setError(null);
    const eth = (window as { ethereum?: EthereumProvider }).ethereum;
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
      if (!address) throw new Error();

      const nonceRes = await fetch("/api/auth/wallet/nonce");
      const nonceJson = (await nonceRes.json()) as {
        data?: { id: string; nonce: string; message: string };
      };
      if (!nonceJson.data) throw new Error();

      const signature = (await eth.request({
        method: "personal_sign",
        params: [nonceJson.data.message, address],
      })) as string;

      const res = await fetch("/api/auth/link/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonceId: nonceJson.data.id,
          nonce: nonceJson.data.nonce,
          address,
          signature,
        }),
      });
      const json = (await res.json()) as { error?: { message: string } };
      if (!res.ok) throw new Error(json.error?.message);
      setNote(t.account.bound);
      await refresh();
    } catch (err) {
      setError(errorText(err instanceof Error ? err.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-20 sm:px-6">
      <div className="halo pt-16 text-center">
        <h1 className="font-serif text-3xl font-semibold">
          {t.account.title}
        </h1>
        <p className="mt-3 text-sm text-muted">{t.account.subtitle}</p>
        <p className="mx-auto mt-4 max-w-sm text-xs leading-5 text-muted/80">
          {t.account.hint}
        </p>
      </div>

      {note && (
        <p className="mt-6 rounded-lg border border-accent/40 bg-halo px-4 py-3 text-center text-sm text-accent-strong">
          {note}
        </p>
      )}
      {error && (
        <p className="mt-6 rounded-lg border border-red-400/40 bg-red-500/5 px-4 py-3 text-center text-sm text-red-500">
          {error}
        </p>
      )}

      {/* Email channel */}
      <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{t.account.emailLabel}</p>
          {user.email ? (
            <span className="max-w-52 truncate text-sm text-accent">
              {user.email}
            </span>
          ) : (
            <span className="text-xs text-muted">{t.account.notBound}</span>
          )}
        </div>
        {!user.email && (
          <div className="mt-4 space-y-3">
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
            {stage === "enter" ? (
              <button
                type="button"
                className="btn-outline w-full !h-10 text-xs"
                disabled={busy || !email.includes("@")}
                onClick={() => void sendCode()}
              >
                {busy ? t.auth.sending : t.account.bindEmail}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary w-full !h-10 text-xs"
                disabled={busy || code.length !== 6}
                onClick={() => void verifyCode()}
              >
                {busy ? t.auth.verifying : t.auth.verify}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Wallet channel */}
      <div className="mt-4 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{t.account.walletLabel}</p>
          {user.wallet ? (
            <span className="text-sm text-accent">
              {user.wallet.slice(0, 6)}…{user.wallet.slice(-4)}
            </span>
          ) : (
            <span className="text-xs text-muted">{t.account.notBound}</span>
          )}
        </div>
        {!user.wallet && (
          <button
            type="button"
            className="btn-outline mt-4 w-full !h-10 text-xs"
            disabled={busy}
            onClick={() => void bindWallet()}
          >
            {t.account.bindWallet}
          </button>
        )}
      </div>
    </div>
  );
}
