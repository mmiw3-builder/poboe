import type { NextRequest } from "next/server";
import { errors, ok } from "@/lib/api/respond";
import { userFromRequest } from "@/lib/auth/session";
import {
  InsufficientBalanceError,
  chargeBytes,
  refundCharge,
} from "@/lib/billing/engine";
import { db, schema } from "@/lib/db";
import { getAppTag } from "@/lib/irys/config";
import { uploadJson } from "@/lib/irys/server";
import { verifyManifest } from "@/lib/memorial/identity";
import { getMemorial } from "@/lib/memorial/repo";
import { TAGS, memorialManifestSchema } from "@/lib/memorial/schema";
import { LIMITS } from "@/lib/moderation/limits";
import { rateLimit } from "@/lib/moderation/rateLimit";
import { moderateText } from "@/lib/moderation/text";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Fetch the latest valid manifest (used by the edit flow). */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return errors.badRequest("Missing id.");
  const result = await getMemorial(id);
  if (!result) return errors.notFound("Memorial not found.");
  return ok({ manifest: result.manifest, txId: result.txId });
}

/**
 * Publish (create or update) a memorial. The client generates the keypair,
 * derives the id and signs the manifest; the server verifies, moderates,
 * then funds the permanent upload.
 */
export async function POST(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return errors.unauthorized();

  const limited = rateLimit(
    "publish",
    user.id,
    LIMITS.publishesPerHour,
  );
  if (!limited.allowed) return errors.rateLimited();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errors.badRequest("Expected a JSON manifest.");
  }

  const parsed = memorialManifestSchema.safeParse(body);
  if (!parsed.success) {
    return errors.badRequest(
      `Invalid manifest: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  const manifest = parsed.data;

  if (!verifyManifest(manifest)) {
    return errors.badRequest(
      "Manifest signature or id derivation failed verification.",
    );
  }

  if (manifest.media.length > LIMITS.maxMediaCount) {
    return errors.badRequest(
      `A memorial may reference at most ${LIMITS.maxMediaCount} media items.`,
    );
  }
  const manifestBytes = Buffer.byteLength(JSON.stringify(manifest), "utf8");
  if (manifestBytes > LIMITS.maxManifestBytes) {
    return errors.tooLarge("Manifest is too large.");
  }

  const verdict = await moderateText([
    manifest.subject.name,
    manifest.subject.altName,
    manifest.subject.epitaph,
    manifest.subject.bio,
    ...manifest.media.map((m) => m.caption),
    manifest.subject.portrait?.caption,
    manifest.subject.voice?.caption,
    ...(manifest.events ?? []).flatMap((ev) => [ev.year, ev.title, ev.detail]),
  ]);
  if (!verdict.ok) return errors.rejected(verdict.reasons);

  let charge;
  try {
    charge = await chargeBytes(
      user.id,
      manifestBytes,
      "publish",
      `manifest ${manifest.id} v${manifest.version} (${manifestBytes}B)`,
    );
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      return errors.insufficientBalance(err.required, err.balance);
    }
    throw err;
  }

  try {
    const result = await uploadJson(manifest, [
      { name: TAGS.appName, value: getAppTag() },
      { name: TAGS.type, value: "memorial" },
      { name: TAGS.memorialId, value: manifest.id },
    ]);
    // Link the memorial to the account (idempotent).
    await db()
      .insert(schema.userMemorials)
      .values({
        userId: user.id,
        memorialId: manifest.id,
        createdAt: Date.now(),
      })
      .onConflictDoNothing()
      .catch(() => {});
    return ok({
      txId: result.id,
      id: manifest.id,
      version: manifest.version,
      costMicroUsd: charge.costMicroUsd,
      freeBytesApplied: charge.freeBytesApplied,
    });
  } catch (err) {
    console.error("memorial publish failed:", err);
    await refundCharge(
      user.id,
      charge,
      "publish-failed",
      "refund failed manifest publish",
    ).catch(() => {});
    return errors.internal("Upload to permanent storage failed.");
  }
}
