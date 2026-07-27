import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, ok } from "@/lib/api/respond";
import { bindEmail, emailInUse, verifyEmailCode } from "@/lib/auth/service";
import { userFromRequest } from "@/lib/auth/session";
import { clientKeyFromHeaders, rateLimit } from "@/lib/moderation/rateLimit";

export const runtime = "nodejs";

const requestSchema = z.object({
  email: z.string().email().max(200),
  code: z.string().regex(/^\d{6}$/),
});

/** Complete binding an email to the signed-in account. */
export async function POST(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return errors.unauthorized();
  if (user.email) return errors.badRequest("An email is already bound.");

  const limited = rateLimit(
    "link-email-verify",
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
  if (!parsed.success) return errors.badRequest("Invalid payload.");

  const valid = await verifyEmailCode(parsed.data.email, parsed.data.code);
  if (!valid) return errors.badRequest("Invalid or expired code.");

  // Re-check under the freshest state — codes take time to type.
  if (await emailInUse(parsed.data.email)) {
    return errors.badRequest("identity_in_use");
  }
  await bindEmail(user.id, parsed.data.email);
  return ok({ bound: true });
}
