"use client";

import { signJournalEntry } from "@/lib/memorial/identity";
import {
  SCHEMA_ENTRY,
  type JournalEntry,
  type MediaRef,
} from "@/lib/memorial/schema";
import type { StoredKey } from "./keystore";

export class EntryPublishError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Sign a journal entry with the memorial's key and publish it. */
export async function publishEntry(
  key: StoredKey,
  input: { text?: string; media?: MediaRef[] },
): Promise<{ txId: string; entry: JournalEntry }> {
  const entry = signJournalEntry(
    {
      schemaId: SCHEMA_ENTRY,
      memorialId: key.memorialId,
      ownerPubKey: key.publicKey,
      text: input.text?.trim() ? input.text.trim() : undefined,
      media: input.media?.length ? input.media : undefined,
      createdAt: Date.now(),
    },
    key.secretKey,
  );

  const res = await fetch("/api/entry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  const json = (await res.json()) as {
    data?: { txId: string };
    error?: { code: string };
  };
  if (!res.ok || !json.data) {
    throw new EntryPublishError(json.error?.code ?? "failed");
  }
  return { txId: json.data.txId, entry };
}
