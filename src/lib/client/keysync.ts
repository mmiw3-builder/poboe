"use client";

import { getKey, saveKey, type StoredKey } from "./keystore";

/**
 * Account-custody sync for space keys. Local keystore first (works offline,
 * works logged-out); the signed-in account is the cross-device fallback —
 * the traditional-app experience: log in anywhere, keep managing.
 */

export interface AccountSpace {
  memorialId: string;
  publicKey: string;
  name: string;
  createdAt: number;
}

/** Custody a key under the account. Best-effort: failure never blocks. */
export async function custodyKey(key: StoredKey): Promise<boolean> {
  try {
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memorialId: key.memorialId,
        publicKey: key.publicKey,
        secretKey: key.secretKey,
        nonce: key.nonce,
        name: key.name,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Spaces custodied under the signed-in account (no secrets). */
export async function listAccountSpaces(): Promise<AccountSpace[]> {
  try {
    const res = await fetch("/api/keys");
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { items: AccountSpace[] } };
    return json.data?.items ?? [];
  } catch {
    return [];
  }
}

/**
 * Resolve the management key for a space: this browser's keystore first,
 * then the account custody (cached locally afterwards).
 */
export async function ensureKey(memorialId: string): Promise<StoredKey | null> {
  const local = getKey(memorialId);
  if (local) return local;
  try {
    const res = await fetch(`/api/keys/${encodeURIComponent(memorialId)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        memorialId: string;
        publicKey: string;
        secretKey: string;
        nonce: string;
        name: string;
        createdAt: number;
      };
    };
    if (!json.data) return null;
    const key: StoredKey = {
      memorialId: json.data.memorialId,
      publicKey: json.data.publicKey,
      secretKey: json.data.secretKey,
      nonce: json.data.nonce,
      name: json.data.name,
      createdAt: json.data.createdAt,
    };
    saveKey(key);
    return key;
  } catch {
    return null;
  }
}
