import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

/** Verify an Ethereum personal_sign signature and recover the address. */

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function personalSignDigest(message: string): Uint8Array {
  const msgBytes = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(
    `\x19Ethereum Signed Message:\n${msgBytes.length}`,
  );
  const joined = new Uint8Array(prefix.length + msgBytes.length);
  joined.set(prefix, 0);
  joined.set(msgBytes, prefix.length);
  return keccak_256(joined);
}

/** Returns the lowercase 0x address that signed `message`, or null. */
export function recoverPersonalSignAddress(
  message: string,
  signatureHex: string,
): string | null {
  try {
    const sig = hexToBytes(signatureHex);
    if (sig.length !== 65) return null;
    const r = sig.slice(0, 32);
    const s = sig.slice(32, 64);
    let v = sig[64];
    if (v >= 27) v -= 27;
    if (v !== 0 && v !== 1) return null;

    const digest = personalSignDigest(message);
    const signature = secp256k1.Signature.fromBytes(
      new Uint8Array([...r, ...s]),
      "compact",
    ).addRecoveryBit(v);
    const pub = signature.recoverPublicKey(digest).toBytes(false);
    const address = keccak_256(pub.slice(1)).slice(-20);
    return `0x${bytesToHex(address)}`;
  } catch {
    return null;
  }
}
