import type { NextRequest } from "next/server";
import { errors, ok } from "@/lib/api/respond";
import { userFromRequest } from "@/lib/auth/session";
import {
  InsufficientBalanceError,
  chargeBytes,
  refundCharge,
} from "@/lib/billing/engine";
import { getAppTag } from "@/lib/irys/config";
import { uploadBuffer } from "@/lib/irys/server";
import { LIMITS, isAllowedMediaType, maxBytesFor } from "@/lib/moderation/limits";
import { rateLimit } from "@/lib/moderation/rateLimit";
import { TAGS } from "@/lib/memorial/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Server-paid media upload. Accepts one image/video per request
 * (multipart field "file"), enforces type/size caps, uploads to Irys and
 * returns the permanent txId. The memorial manifest later references these
 * txIds; media itself needs no index tags.
 */
export async function POST(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return errors.unauthorized();

  const limited = rateLimit(
    "upload",
    user.id,
    LIMITS.uploadsPerHour,
  );
  if (!limited.allowed) return errors.rateLimited();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errors.badRequest("Expected multipart/form-data with a `file` field.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return errors.badRequest("Missing `file` field.");
  }

  const kind = isAllowedMediaType(file.type);
  if (!kind) {
    return errors.unsupported(
      `Unsupported content type "${file.type}". Allowed: ${[
        ...LIMITS.allowedImageTypes,
        ...LIMITS.allowedVideoTypes,
        ...LIMITS.allowedAudioTypes,
      ].join(", ")}`,
    );
  }
  const maxBytes = maxBytesFor(kind);
  if (file.size > maxBytes) {
    return errors.tooLarge(
      `File is ${file.size} bytes; the limit for ${kind} is ${maxBytes}.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > maxBytes) {
    return errors.tooLarge("File exceeds the size limit.");
  }

  // Charge first (free allowance applied automatically), refund on failure.
  let charge;
  try {
    charge = await chargeBytes(
      user.id,
      buffer.length,
      "upload",
      `media ${file.type} (${buffer.length}B)`,
    );
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      return errors.insufficientBalance(err.required, err.balance);
    }
    throw err;
  }

  try {
    const result = await uploadBuffer(buffer, [
      { name: TAGS.contentType, value: file.type },
      { name: TAGS.appName, value: getAppTag() },
    ]);
    return ok({
      txId: result.id,
      kind,
      contentType: file.type,
      size: buffer.length,
      costMicroUsd: charge.costMicroUsd,
      freeBytesApplied: charge.freeBytesApplied,
    });
  } catch (err) {
    console.error("media upload failed:", err);
    await refundCharge(user.id, charge, "upload-failed", "refund failed media upload").catch(
      () => {},
    );
    return errors.internal("Upload to permanent storage failed.");
  }
}
