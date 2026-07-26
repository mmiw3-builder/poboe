import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, ok } from "@/lib/api/respond";
import { getAppTag } from "@/lib/irys/config";
import { uploadJson } from "@/lib/irys/server";
import { getMemorial, listContributions } from "@/lib/memorial/repo";
import {
  SCHEMA_CONTRIBUTION,
  TAGS,
  type Contribution,
} from "@/lib/memorial/schema";
import { clientKeyFromHeaders, rateLimit } from "@/lib/moderation/rateLimit";
import { moderateText } from "@/lib/moderation/text";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  memorialId: z.string().min(10).max(40),
  name: z.string().max(60).optional(),
  relation: z.string().max(60).optional(),
  story: z.string().min(1).max(2000),
});

/**
 * Visitors contribute memory fragments. Contributions are permanent records
 * but display only after the memorial owner approves them (their txIds get
 * embedded in the next signed manifest version).
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(
    "contribution",
    clientKeyFromHeaders(req.headers),
    10,
  );
  if (!limited.allowed) return errors.rateLimited();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errors.badRequest("Expected JSON.");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid contribution.");
  const input = parsed.data;

  const memorial = await getMemorial(input.memorialId);
  if (!memorial) return errors.notFound("Memorial not found.");

  const verdict = await moderateText([input.story, input.name, input.relation]);
  if (!verdict.ok) return errors.rejected(verdict.reasons);

  const contribution: Contribution = {
    schemaId: SCHEMA_CONTRIBUTION,
    memorialId: input.memorialId,
    name: input.name?.trim() || undefined,
    relation: input.relation?.trim() || undefined,
    story: input.story.trim(),
    createdAt: Date.now(),
  };

  try {
    const result = await uploadJson(contribution, [
      { name: TAGS.appName, value: getAppTag() },
      { name: TAGS.type, value: "contribution" },
      { name: TAGS.memorialId, value: contribution.memorialId },
    ]);
    return ok({ txId: result.id });
  } catch (err) {
    console.error("contribution upload failed:", err);
    return errors.internal("Upload to permanent storage failed.");
  }
}

/** List all visible contributions for a memorial (used by the owner's review panel). */
export async function GET(req: NextRequest) {
  const memorialId = req.nextUrl.searchParams.get("memorialId");
  if (!memorialId || !/^[A-Za-z0-9_-]{10,40}$/.test(memorialId)) {
    return errors.badRequest("Missing or invalid memorialId.");
  }
  const items = await listContributions(memorialId);
  return ok({ items });
}
