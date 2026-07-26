import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, ok } from "@/lib/api/respond";
import { clientKeyFromHeaders, rateLimit } from "@/lib/moderation/rateLimit";
import { confirmWatch } from "@/lib/watch/service";

export const runtime = "nodejs";

const requestSchema = z.object({
  token: z.string().min(16).max(64),
});

/** Trusted contact confirms; the 30-day cooling period begins. */
export async function POST(req: NextRequest) {
  const limited = rateLimit(
    "watch-confirm",
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
  if (!parsed.success) return errors.badRequest("Invalid token.");

  const result = await confirmWatch(parsed.data.token);
  if (!result.ok) {
    return errors.notFound("This confirmation link is invalid or has expired.");
  }
  return ok({ confirmed: true, coolingEndsAt: result.coolingEndsAt });
}
