"use client";

import { generateKeyPair } from "@/lib/crypto";
import { deriveMemorialId, signManifest } from "@/lib/memorial/identity";
import {
  SCHEMA_MEMORIAL,
  type LifeEvent,
  type MediaRef,
  type MemorialManifest,
  type SubjectStatus,
  type UnsignedMemorialManifest,
} from "@/lib/memorial/schema";
import { saveKey, type StoredKey } from "./keystore";

export interface MemorialDraft {
  name: string;
  status?: SubjectStatus;
  altName?: string;
  born?: string;
  died?: string;
  bornDate?: string;
  diedDate?: string;
  epitaph?: string;
  bio?: string;
  portrait?: MediaRef;
  voice?: MediaRef;
  media: MediaRef[];
  events?: LifeEvent[];
  approvedContributions?: string[];
  tributesEnabled: boolean;
  lang: string;
}

export class PublishError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function postManifest(manifest: MemorialManifest): Promise<string> {
  const res = await fetch("/api/memorial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(manifest),
  });
  const json = (await res.json()) as {
    data?: { txId: string };
    error?: { code: string };
  };
  if (!res.ok || !json.data) {
    throw new PublishError(json.error?.code ?? "failed");
  }
  return json.data.txId;
}

function toSubject(draft: MemorialDraft) {
  const clean = (s?: string) => {
    const t = s?.trim();
    return t ? t : undefined;
  };
  const living = draft.status === "living";
  return {
    name: draft.name.trim(),
    status: draft.status,
    altName: clean(draft.altName),
    born: clean(draft.born),
    // A living subject can never carry a closing date.
    died: living ? undefined : clean(draft.died),
    bornDate: clean(draft.bornDate),
    diedDate: living ? undefined : clean(draft.diedDate),
    epitaph: clean(draft.epitaph),
    bio: clean(draft.bio),
    portrait: draft.portrait,
    voice: draft.voice,
  };
}

/** Omit empty optional arrays so old-style manifests stay byte-identical. */
function optionalArrays(draft: MemorialDraft): {
  events?: LifeEvent[];
  approvedContributions?: string[];
} {
  return {
    events: draft.events?.length ? draft.events : undefined,
    approvedContributions: draft.approvedContributions?.length
      ? draft.approvedContributions
      : undefined,
  };
}

/** Create a brand-new memorial: fresh keypair, derived id, signed publish. */
export async function publishNewMemorial(draft: MemorialDraft): Promise<{
  memorialId: string;
  txId: string;
  key: StoredKey;
}> {
  const keyPair = generateKeyPair();
  const nonce = crypto.randomUUID();
  const memorialId = deriveMemorialId(keyPair.publicKey, nonce);
  const now = Date.now();

  const unsigned: UnsignedMemorialManifest = {
    schemaId: SCHEMA_MEMORIAL,
    id: memorialId,
    nonce,
    ownerPubKey: keyPair.publicKey,
    createdAt: now,
    updatedAt: now,
    version: 1,
    lang: draft.lang,
    subject: toSubject(draft),
    media: draft.media,
    ...optionalArrays(draft),
    tributesEnabled: draft.tributesEnabled,
  };
  const manifest = signManifest(unsigned, keyPair.secretKey);
  const txId = await postManifest(manifest);

  const key: StoredKey = {
    memorialId,
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey,
    nonce,
    name: draft.name.trim(),
    createdAt: now,
  };
  saveKey(key);
  return { memorialId, txId, key };
}

/** Publish a new version of an existing memorial using its stored key. */
export async function publishUpdate(
  key: StoredKey,
  previous: Pick<MemorialManifest, "createdAt" | "version">,
  draft: MemorialDraft,
): Promise<{ txId: string }> {
  const unsigned: UnsignedMemorialManifest = {
    schemaId: SCHEMA_MEMORIAL,
    id: key.memorialId,
    nonce: key.nonce,
    ownerPubKey: key.publicKey,
    createdAt: previous.createdAt,
    updatedAt: Date.now(),
    version: previous.version + 1,
    lang: draft.lang,
    subject: toSubject(draft),
    media: draft.media,
    ...optionalArrays(draft),
    tributesEnabled: draft.tributesEnabled,
  };
  const manifest = signManifest(unsigned, key.secretKey);
  const txId = await postManifest(manifest);
  return { txId };
}
