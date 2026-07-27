import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, ok } from "@/lib/api/respond";
import { encryptSecret } from "@/lib/auth/keycustody";
import { userFromRequest } from "@/lib/auth/session";
import { publicKeyOf } from "@/lib/crypto";
import { db, schema } from "@/lib/db";
import { deriveMemorialId } from "@/lib/memorial/identity";

export const runtime = "nodejs";

const base64Url = /^[A-Za-z0-9_-]+$/;

const saveSchema = z.object({
  memorialId: z.string().min(10).max(40).regex(base64Url),
  publicKey: z.string().min(40).max(50).regex(base64Url),
  secretKey: z.string().min(40).max(100).regex(base64Url),
  nonce: z.string().min(8).max(64),
  name: z.string().max(120).optional(),
});

/** Spaces custodied under this account (never returns secrets). */
export async function GET(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return errors.unauthorized();
  const rows = await db()
    .select({
      memorialId: schema.memorialKeys.memorialId,
      publicKey: schema.memorialKeys.publicKey,
      name: schema.memorialKeys.name,
      createdAt: schema.memorialKeys.createdAt,
    })
    .from(schema.memorialKeys)
    .where(eq(schema.memorialKeys.userId, user.id));
  return ok({ items: rows });
}

/**
 * Custody a space key under the signed-in account. The key material is
 * validated for internal consistency (secret → public → id) so a corrupt
 * or foreign key can never be attached to someone's space.
 */
export async function POST(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return errors.unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errors.badRequest("Expected JSON.");
  }
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid key payload.");
  const { memorialId, publicKey, secretKey, nonce, name } = parsed.data;

  try {
    if (publicKeyOf(secretKey) !== publicKey) {
      return errors.badRequest("Key pair mismatch.");
    }
  } catch {
    return errors.badRequest("Malformed secret key.");
  }
  if (deriveMemorialId(publicKey, nonce) !== memorialId) {
    return errors.badRequest("Key does not own this space id.");
  }

  const existing = await db()
    .select({
      id: schema.memorialKeys.id,
      userId: schema.memorialKeys.userId,
    })
    .from(schema.memorialKeys)
    .where(eq(schema.memorialKeys.memorialId, memorialId))
    .limit(1);
  if (existing[0] && existing[0].userId !== user.id) {
    // Holding the key proves control of the space, but custody still stays
    // with the first account — moving it silently would surprise the owner.
    return errors.badRequest("This space is custodied by another account.");
  }

  const now = Date.now();
  if (existing[0]) {
    await db()
      .update(schema.memorialKeys)
      .set({
        encryptedSecretKey: encryptSecret(secretKey),
        name: name?.trim() ?? "",
      })
      .where(eq(schema.memorialKeys.id, existing[0].id));
  } else {
    await db().insert(schema.memorialKeys).values({
      id: crypto.randomUUID(),
      userId: user.id,
      memorialId,
      publicKey,
      nonce,
      name: name?.trim() ?? "",
      encryptedSecretKey: encryptSecret(secretKey),
      createdAt: now,
    });
  }
  // Ensure the ownership link exists even for imported/legacy spaces.
  await db()
    .insert(schema.userMemorials)
    .values({ userId: user.id, memorialId, createdAt: now })
    .onConflictDoNothing()
    .catch(() => {});
  return ok({ saved: true });
}
