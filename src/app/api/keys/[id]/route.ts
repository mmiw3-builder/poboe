import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { errors, ok } from "@/lib/api/respond";
import { decryptSecret } from "@/lib/auth/keycustody";
import { userFromRequest } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

/** Retrieve one custodied key so a signed-in device can manage the space. */
export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/keys/[id]">,
) {
  const user = await userFromRequest(req);
  if (!user) return errors.unauthorized();
  const { id } = await ctx.params;

  const rows = await db()
    .select()
    .from(schema.memorialKeys)
    .where(
      and(
        eq(schema.memorialKeys.memorialId, id),
        eq(schema.memorialKeys.userId, user.id),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return errors.notFound("No custodied key for this space.");

  let secretKey: string;
  try {
    secretKey = decryptSecret(row.encryptedSecretKey);
  } catch (err) {
    console.error("key custody decrypt failed:", err);
    return errors.internal("Stored key could not be decrypted.");
  }
  return ok({
    memorialId: row.memorialId,
    publicKey: row.publicKey,
    secretKey,
    nonce: row.nonce,
    name: row.name,
    createdAt: row.createdAt,
  });
}

/** Opt out of custody (self-custody users). The on-chain space is untouched. */
export async function DELETE(
  req: NextRequest,
  ctx: RouteContext<"/api/keys/[id]">,
) {
  const user = await userFromRequest(req);
  if (!user) return errors.unauthorized();
  const { id } = await ctx.params;
  await db()
    .delete(schema.memorialKeys)
    .where(
      and(
        eq(schema.memorialKeys.memorialId, id),
        eq(schema.memorialKeys.userId, user.id),
      ),
    );
  return ok({ deleted: true });
}
