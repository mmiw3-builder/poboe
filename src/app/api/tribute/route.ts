import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, ok } from "@/lib/api/respond";
import { getAppTag } from "@/lib/irys/config";
import { uploadJson } from "@/lib/irys/server";
import { getMemorial } from "@/lib/memorial/repo";
import { SCHEMA_TRIBUTE, TAGS, type Tribute } from "@/lib/memorial/schema";
import { LIMITS } from "@/lib/moderation/limits";
import { clientKeyFromHeaders, rateLimit } from "@/lib/moderation/rateLimit";
import { moderateText } from "@/lib/moderation/text";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  memorialId: z.string().min(10).max(40),
  kind: z.enum(["flower", "candle", "message"]),
  message: z.string().max(1000).optional(),
  name: z.string().max(60).optional(),
});

/** Visitors lay flowers, light candles and leave messages — small permanent records. */
export async function POST(req: NextRequest) {
  const limited = rateLimit(
    "tribute",
    clientKeyFromHeaders(req.headers),
    LIMITS.tributesPerHour,
  );
  if (!limited.allowed) return errors.rateLimited();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errors.badRequest("Expected JSON.");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid tribute.");
  const input = parsed.data;

  if (input.kind === "message" && !input.message?.trim()) {
    return errors.badRequest("A message tribute needs message text.");
  }

  const memorial = await getMemorial(input.memorialId);
  if (!memorial) return errors.notFound("Memorial not found.");
  if (!memorial.manifest.tributesEnabled) {
    return errors.badRequest("Tributes are disabled for this memorial.");
  }

  const verdict = await moderateText([input.message, input.name]);
  if (!verdict.ok) return errors.rejected(verdict.reasons);

  const tribute: Tribute = {
    schemaId: SCHEMA_TRIBUTE,
    memorialId: input.memorialId,
    kind: input.kind,
    message: input.message?.trim() || undefined,
    name: input.name?.trim() || undefined,
    createdAt: Date.now(),
  };

  try {
    const result = await uploadJson(tribute, [
      { name: TAGS.appName, value: getAppTag() },
      { name: TAGS.type, value: "tribute" },
      { name: TAGS.memorialId, value: tribute.memorialId },
    ]);
    return ok({ txId: result.id });
  } catch (err) {
    console.error("tribute upload failed:", err);
    return errors.internal("Upload to permanent storage failed.");
  }
}
