import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * At-rest encryption for custodied space keys (AES-256-GCM). The KEK is
 * derived from KEY_ENCRYPTION_SECRET (falling back to SESSION_SECRET) so a
 * leaked database dump alone cannot reveal management keys.
 */

function kek(): Buffer {
  const secret =
    process.env.KEY_ENCRYPTION_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "KEY_ENCRYPTION_SECRET (or SESSION_SECRET) must be set in production.",
      );
    }
    return createHash("sha256").update("poboe-dev-key-custody").digest();
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", kek(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    ct.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function decryptSecret(blob: string): string {
  const [version, ivB64, ctB64, tagB64] = blob.split(".");
  if (version !== "v1" || !ivB64 || !ctB64 || !tagB64) {
    throw new Error("unknown custody blob format");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    kek(),
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
