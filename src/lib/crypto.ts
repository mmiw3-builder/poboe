/**
 * Ed25519 signing primitives, isomorphic (browser + Node).
 * Ownership of a memorial is a keypair generated in the creator's browser —
 * no crypto wallet involved.
 */
import * as ed from "@noble/ed25519";
import { sha256, sha512 } from "@noble/hashes/sha2.js";
import { base64UrlToBytes, bytesToBase64Url, utf8ToBytes } from "./codec";

// @noble/ed25519 v3 requires wiring a sha512 implementation once.
ed.hashes.sha512 = sha512;

export interface KeyPair {
  /** base64url, 32 bytes */
  publicKey: string;
  /** base64url, 32 bytes */
  secretKey: string;
}

export function generateKeyPair(): KeyPair {
  const secret = ed.utils.randomSecretKey();
  const pub = ed.getPublicKey(secret);
  return {
    publicKey: bytesToBase64Url(pub),
    secretKey: bytesToBase64Url(secret),
  };
}

export function signMessage(message: string, secretKeyB64: string): string {
  const sig = ed.sign(utf8ToBytes(message), base64UrlToBytes(secretKeyB64));
  return bytesToBase64Url(sig);
}

export function verifyMessage(
  message: string,
  signatureB64: string,
  publicKeyB64: string,
): boolean {
  try {
    return ed.verify(
      base64UrlToBytes(signatureB64),
      utf8ToBytes(message),
      base64UrlToBytes(publicKeyB64),
    );
  } catch {
    return false;
  }
}

export function publicKeyOf(secretKeyB64: string): string {
  return bytesToBase64Url(ed.getPublicKey(base64UrlToBytes(secretKeyB64)));
}

export function sha256Base64Url(data: Uint8Array): string {
  return bytesToBase64Url(sha256(data));
}
