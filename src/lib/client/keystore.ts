"use client";

/**
 * Local keystore for memorial management keys. Keys never leave the
 * browser except through the user's explicit backup download.
 */

export interface StoredKey {
  memorialId: string;
  publicKey: string;
  secretKey: string;
  nonce: string;
  name: string;
  createdAt: number;
}

const STORAGE_KEY = "poboe_keys_v1";

function readAll(): Record<string, StoredKey> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      StoredKey
    >;
  } catch {
    return {};
  }
}

function writeAll(keys: Record<string, StoredKey>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function saveKey(key: StoredKey): void {
  const all = readAll();
  all[key.memorialId] = key;
  writeAll(all);
}

export function getKey(memorialId: string): StoredKey | null {
  return readAll()[memorialId] ?? null;
}

export function listKeys(): StoredKey[] {
  return Object.values(readAll()).sort((a, b) => b.createdAt - a.createdAt);
}

export function removeKey(memorialId: string): void {
  const all = readAll();
  delete all[memorialId];
  writeAll(all);
}

export function importKey(json: string): StoredKey {
  const parsed = JSON.parse(json) as Partial<StoredKey>;
  if (
    !parsed.memorialId ||
    !parsed.publicKey ||
    !parsed.secretKey ||
    !parsed.nonce
  ) {
    throw new Error("invalid key backup file");
  }
  const key: StoredKey = {
    memorialId: parsed.memorialId,
    publicKey: parsed.publicKey,
    secretKey: parsed.secretKey,
    nonce: parsed.nonce,
    name: parsed.name ?? "",
    createdAt: parsed.createdAt ?? Date.now(),
  };
  saveKey(key);
  return key;
}

/** Serialize one key as a downloadable backup file. */
export function keyBackupBlob(key: StoredKey): Blob {
  const backup = {
    app: "poboe-evermark",
    format: "key-backup@1",
    warning:
      "Keep this file safe. Anyone holding it can edit the memorial. / 请妥善保管，持有此文件即可管理该纪念空间。",
    ...key,
  };
  return new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
}
