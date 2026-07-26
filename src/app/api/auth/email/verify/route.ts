import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { errors } from "@/lib/api/respond";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth/session";
import {
  findOrCreateUserByEmail,
  verifyEmailCode,
} from "@/lib/auth/service";
import { clientKeyFromHeaders, rateLimit } from "@/lib/moderation/rateLimit";

export const runtime = "nodejs";

const requestSchema = z.object({
  email: z.string().email().max(200),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(
    "auth-verify",
    clientKeyFromHeaders(req.headers),
    20,
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

  const user = await findOrCreateUserByEmail(parsed.data.email);
  const token = await createSessionToken(user.id);
  const res = NextResponse.json({
    data: { user: { id: user.id, email: user.email, wallet: user.wallet } },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
