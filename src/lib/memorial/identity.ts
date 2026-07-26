import { canonicalStringify } from "../canonical";
import { base64UrlToBytes, utf8ToBytes } from "../codec";
import { sha256Base64Url, signMessage, verifyMessage } from "../crypto";
import type {
  JournalEntry,
  MemorialManifest,
  ModerationRecord,
  TransitionRecord,
  UnsignedJournalEntry,
  UnsignedMemorialManifest,
} from "./schema";

/**
 * A memorial's id is derived from its owner's public key and a nonce:
 *   id = base64url(sha256(pubKeyBytes || ":" || nonce))[0..22)
 * Nobody can claim an id without holding the matching secret key, so
 * ownership is intrinsic to the id — independent of upload order and of
 * any central registry.
 */
export function deriveMemorialId(
  ownerPubKeyB64: string,
  nonce: string,
): string {
  const pub = base64UrlToBytes(ownerPubKeyB64);
  const sep = utf8ToBytes(":" + nonce);
  const joined = new Uint8Array(pub.length + sep.length);
  joined.set(pub, 0);
  joined.set(sep, pub.length);
  return sha256Base64Url(joined).slice(0, 22);
}

function manifestSigningPayload(manifest: UnsignedMemorialManifest): string {
  const { ...unsigned } = manifest as UnsignedMemorialManifest & {
    sig?: string;
  };
  delete unsigned.sig;
  return canonicalStringify(unsigned);
}

export function signManifest(
  manifest: UnsignedMemorialManifest,
  secretKeyB64: string,
): MemorialManifest {
  const sig = signMessage(manifestSigningPayload(manifest), secretKeyB64);
  return { ...manifest, sig };
}

/**
 * Full trust check for a manifest read from the network:
 * 1. its id must derive from its ownerPubKey + nonce;
 * 2. its signature must verify against ownerPubKey.
 */
export function verifyManifest(manifest: MemorialManifest): boolean {
  if (deriveMemorialId(manifest.ownerPubKey, manifest.nonce) !== manifest.id) {
    return false;
  }
  return verifyMessage(
    manifestSigningPayload(manifest),
    manifest.sig,
    manifest.ownerPubKey,
  );
}

function moderationSigningPayload(
  record: Omit<ModerationRecord, "sig">,
): string {
  const { ...unsigned } = record as Omit<ModerationRecord, "sig"> & {
    sig?: string;
  };
  delete unsigned.sig;
  return canonicalStringify(unsigned);
}

export function signModerationRecord(
  record: Omit<ModerationRecord, "sig">,
  secretKeyB64: string,
): ModerationRecord {
  const sig = signMessage(moderationSigningPayload(record), secretKeyB64);
  return { ...record, sig };
}

export function verifyModerationRecord(
  record: ModerationRecord,
  trustedAdminPubKeyB64: string,
): boolean {
  if (record.adminPubKey !== trustedAdminPubKeyB64) return false;
  return verifyMessage(
    moderationSigningPayload(record),
    record.sig,
    record.adminPubKey,
  );
}

/** Journal entries are signed by the memorial's own management key. */
function entrySigningPayload(entry: UnsignedJournalEntry): string {
  const { ...unsigned } = entry as UnsignedJournalEntry & { sig?: string };
  delete unsigned.sig;
  return canonicalStringify(unsigned);
}

export function signJournalEntry(
  entry: UnsignedJournalEntry,
  secretKeyB64: string,
): JournalEntry {
  const sig = signMessage(entrySigningPayload(entry), secretKeyB64);
  return { ...entry, sig };
}

/**
 * An entry is trusted only when it is signed by the key that owns the
 * memorial it claims to belong to — pass the manifest's ownerPubKey.
 */
export function verifyJournalEntry(
  entry: JournalEntry,
  memorialOwnerPubKeyB64: string,
): boolean {
  if (entry.ownerPubKey !== memorialOwnerPubKeyB64) return false;
  return verifyMessage(
    entrySigningPayload(entry),
    entry.sig,
    entry.ownerPubKey,
  );
}

/** Watch-transition attestations use the same admin key as moderation. */
function transitionSigningPayload(
  record: Omit<TransitionRecord, "sig">,
): string {
  const { ...unsigned } = record as Omit<TransitionRecord, "sig"> & {
    sig?: string;
  };
  delete unsigned.sig;
  return canonicalStringify(unsigned);
}

export function signTransitionRecord(
  record: Omit<TransitionRecord, "sig">,
  secretKeyB64: string,
): TransitionRecord {
  const sig = signMessage(transitionSigningPayload(record), secretKeyB64);
  return { ...record, sig };
}

export function verifyTransitionRecord(
  record: TransitionRecord,
  trustedAdminPubKeyB64: string,
): boolean {
  if (record.adminPubKey !== trustedAdminPubKeyB64) return false;
  return verifyMessage(
    transitionSigningPayload(record),
    record.sig,
    record.adminPubKey,
  );
}
