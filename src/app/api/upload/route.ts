import type { NextRequest } from "next/server";
import { errors, ok } from "@/lib/api/respond";
import { userFromRequest } from "@/lib/auth/session";
import { getAppTag } from "@/lib/irys/config";
import { uploadBuffer } from "@/lib/irys/server";
import { LIMITS, isAllowedMediaType, maxBytesFor } from "@/lib/moderation/limits";
import { clientKeyFromHeaders, rateLimit } from "@/lib/moderation/rateLimit";
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
    });
  } catch (err) {
    console.error("media upload failed:", err);
    return errors.internal("Upload to permanent storage failed.");
  }
}
