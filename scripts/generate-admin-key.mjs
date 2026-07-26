// Generates the Ed25519 admin key for MODERATION_ADMIN_SECRET.
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

ed.hashes.sha512 = sha512;

const toB64Url = (bytes) =>
  Buffer.from(bytes)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

const secret = ed.utils.randomSecretKey();
const pub = ed.getPublicKey(secret);

console.log("MODERATION_ADMIN_SECRET=" + toB64Url(secret));
console.log("# public key (derived automatically at runtime):", toB64Url(pub));
