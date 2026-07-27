import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, ok } from "@/lib/api/respond";
import {
  emailInUse,
  sendLoginEmail,
  startEmailLogin,
} from "@/lib/auth/service";
import { userFromRequest } from "@/lib/auth/session";
import { clientKeyFromHeaders, rateLimit } from "@/lib/moderation/rateLimit";

export const runtime = "nodejs";

const requestSchema = z.object({ email: z.string().email().max(200) });

/** Begin binding an email to a signed-in (wallet-only) account. */
export async function POST(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return errors.unauthorized();
  if (user.email) return errors.badRequest("An email is already bound.");

  const limited = rateLimit("link-email", clientKeyFromHeaders(req.headers), 5);
  if (!limited.allowed) return errors.rateLimited();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errors.badRequest("Expected JSON.");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid email.");

  // Never merge accounts: an identity in use elsewhere cannot be bound.
  if (await emailInUse(parsed.data.email)) {
    return errors.badRequest("identity_in_use");
  }

  const code = await startEmailLogin(parsed.data.email);
  const sent = await sendLoginEmail(parsed.data.email, code);
  if (!sent && process.env.NODE_ENV !== "production") {
    return ok({ sent: false, devCode: code });
  }
  return ok({ sent });
}
