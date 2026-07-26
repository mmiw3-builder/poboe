import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, ok } from "@/lib/api/respond";
import { sendLoginEmail, startEmailLogin } from "@/lib/auth/service";
import { clientKeyFromHeaders, rateLimit } from "@/lib/moderation/rateLimit";

export const runtime = "nodejs";

const requestSchema = z.object({ email: z.string().email().max(200) });

export async function POST(req: NextRequest) {
  const limited = rateLimit(
    "auth-email",
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
  if (!parsed.success) return errors.badRequest("Invalid email.");

  const code = await startEmailLogin(parsed.data.email);
  const sent = await sendLoginEmail(parsed.data.email, code);

  if (sent) return ok({ sent: true });

  // No email provider configured: usable in development only — the code is
  // returned to the client so the flow can be exercised end-to-end.
  if (process.env.NODE_ENV !== "production") {
    console.log(`[dev] login code for ${parsed.data.email}: ${code}`);
    return ok({ sent: false, devCode: code });
  }
  return errors.internal(
    "Email delivery is not configured (RESEND_API_KEY missing).",
  );
}
