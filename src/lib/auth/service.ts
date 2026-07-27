import { and, eq, gt, isNull } from "drizzle-orm";
import { sha256 } from "@noble/hashes/sha2.js";
import { db, schema } from "@/lib/db";
import { bytesToBase64Url, utf8ToBytes } from "@/lib/codec";

/** Email-code and wallet-nonce authentication primitives. */

const CODE_TTL_MS = 10 * 60 * 1000;
const NONCE_TTL_MS = 10 * 60 * 1000;

function hashCode(email: string, code: string): string {
  return bytesToBase64Url(sha256(utf8ToBytes(`${email}:${code}`)));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function startEmailLogin(emailRaw: string): Promise<string> {
  const email = normalizeEmail(emailRaw);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await db().insert(schema.authCodes).values({
    id: crypto.randomUUID(),
    email,
    codeHash: hashCode(email, code),
    expiresAt: Date.now() + CODE_TTL_MS,
    consumedAt: null,
    createdAt: Date.now(),
  });
  return code;
}

export async function verifyEmailCode(
  emailRaw: string,
  code: string,
): Promise<boolean> {
  const email = normalizeEmail(emailRaw);
  const rows = await db()
    .select()
    .from(schema.authCodes)
    .where(
      and(
        eq(schema.authCodes.email, email),
        eq(schema.authCodes.codeHash, hashCode(email, code)),
        gt(schema.authCodes.expiresAt, Date.now()),
        isNull(schema.authCodes.consumedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return false;
  await db()
    .update(schema.authCodes)
    .set({ consumedAt: Date.now() })
    .where(eq(schema.authCodes.id, row.id));
  return true;
}

export async function createWalletNonce(): Promise<{
  id: string;
  nonce: string;
}> {
  const id = crypto.randomUUID();
  const nonce = crypto.randomUUID().replaceAll("-", "");
  await db().insert(schema.walletNonces).values({
    id,
    nonce,
    expiresAt: Date.now() + NONCE_TTL_MS,
    createdAt: Date.now(),
  });
  return { id, nonce };
}

export async function consumeWalletNonce(
  id: string,
  nonce: string,
): Promise<boolean> {
  const rows = await db()
    .select()
    .from(schema.walletNonces)
    .where(
      and(
        eq(schema.walletNonces.id, id),
        eq(schema.walletNonces.nonce, nonce),
        gt(schema.walletNonces.expiresAt, Date.now()),
      ),
    )
    .limit(1);
  if (!rows[0]) return false;
  await db()
    .delete(schema.walletNonces)
    .where(eq(schema.walletNonces.id, id));
  return true;
}

export async function findOrCreateUserByEmail(emailRaw: string) {
  const email = normalizeEmail(emailRaw);
  const existing = await db()
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (existing[0]) return existing[0];
  const user = {
    id: crypto.randomUUID(),
    email,
    wallet: null,
    displayName: null,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  };
  await db().insert(schema.users).values(user);
  return user;
}

export async function findOrCreateUserByWallet(addressLower: string) {
  const existing = await db()
    .select()
    .from(schema.users)
    .where(eq(schema.users.wallet, addressLower))
    .limit(1);
  if (existing[0]) return existing[0];
  const user = {
    id: crypto.randomUUID(),
    email: null,
    wallet: addressLower,
    displayName: null,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  };
  await db().insert(schema.users).values(user);
  return user;
}

export async function emailInUse(emailRaw: string): Promise<boolean> {
  const rows = await db()
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, normalizeEmail(emailRaw)))
    .limit(1);
  return rows.length > 0;
}

export async function walletInUse(addressLower: string): Promise<boolean> {
  const rows = await db()
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.wallet, addressLower))
    .limit(1);
  return rows.length > 0;
}

/** Bind a second sign-in channel. Callers must have checked availability. */
export async function bindEmail(userId: string, emailRaw: string) {
  await db()
    .update(schema.users)
    .set({ email: normalizeEmail(emailRaw) })
    .where(eq(schema.users.id, userId));
}

export async function bindWallet(userId: string, addressLower: string) {
  await db()
    .update(schema.users)
    .set({ wallet: addressLower })
    .where(eq(schema.users.id, userId));
}

/** Sends the login code via Resend when configured; returns false otherwise. */
export async function sendLoginEmail(
  email: string,
  code: string,
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Evermark <noreply@evermark.example>",
        to: [email],
        subject: `永铭 Evermark 登录验证码：${code}`,
        text: `您的登录验证码是 ${code}，10 分钟内有效。\nYour Evermark login code is ${code}. It expires in 10 minutes.`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
