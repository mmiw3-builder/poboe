import type { NextRequest } from "next/server";
import { errors, ok } from "@/lib/api/respond";
import { userFromRequest } from "@/lib/auth/session";
import {
  InsufficientBalanceError,
  chargeBytes,
  refundCharge,
} from "@/lib/billing/engine";
import { getAppTag } from "@/lib/irys/config";
import { uploadJson } from "@/lib/irys/server";
import { verifyJournalEntry } from "@/lib/memorial/identity";
import { getMemorial } from "@/lib/memorial/repo";
import { TAGS, journalEntrySchema } from "@/lib/memorial/schema";
import { LIMITS } from "@/lib/moderation/limits";
import { rateLimitPersistent } from "@/lib/moderation/rateLimit";
import { moderateText } from "@/lib/moderation/text";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Publish a journal entry (时光记录). The client signs the entry with the
 * memorial's management key; the server verifies it against the memorial's
 * manifest, moderates, charges and funds the permanent upload.
 */
export async function POST(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return errors.unauthorized();

  const limited = await rateLimitPersistent(
    "entry",
    user.id,
    LIMITS.entriesPerHour,
  );
  if (!limited.allowed) return errors.rateLimited();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errors.badRequest("Expected a JSON entry.");
  }
  const parsed = journalEntrySchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid entry.");
  const entry = parsed.data;

  if (!entry.text?.trim() && !(entry.media?.length ?? 0)) {
    return errors.badRequest("An entry needs text or at least one photo.");
  }

  const memorial = await getMemorial(entry.memorialId);
  if (!memorial) return errors.notFound("Memorial not found.");
  if (!verifyJournalEntry(entry, memorial.manifest.ownerPubKey)) {
    return errors.badRequest("Entry signature failed verification.");
  }

  const verdict = await moderateText([
    entry.text,
    ...(entry.media ?? []).map((m) => m.caption),
  ]);
  if (!verdict.ok) return errors.rejected(verdict.reasons);

  const entryBytes = Buffer.byteLength(JSON.stringify(entry), "utf8");
  let charge;
  try {
    charge = await chargeBytes(
      user.id,
      entryBytes,
      "entry",
      `entry for ${entry.memorialId} (${entryBytes}B)`,
    );
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      return errors.insufficientBalance(err.required, err.balance);
    }
    throw err;
  }

  try {
    const result = await uploadJson(entry, [
      { name: TAGS.appName, value: getAppTag() },
      { name: TAGS.type, value: "entry" },
      { name: TAGS.memorialId, value: entry.memorialId },
    ]);
    return ok({
      txId: result.id,
      costMicroUsd: charge.costMicroUsd,
      freeBytesApplied: charge.freeBytesApplied,
    });
  } catch (err) {
    console.error("entry publish failed:", err);
    await refundCharge(
      user.id,
      charge,
      "entry-failed",
      "refund failed entry publish",
    ).catch(() => {});
    return errors.internal("Upload to permanent storage failed.");
  }
}
