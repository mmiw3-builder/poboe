import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { errors } from "@/lib/api/respond";
import { recoverPersonalSignAddress } from "@/lib/auth/ethsig";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth/session";
import {
  consumeWalletNonce,
  findOrCreateUserByWallet,
} from "@/lib/auth/service";
import { clientKeyFromHeaders, rateLimit } from "@/lib/moderation/rateLimit";
import { resetWatchesOnActivity } from "@/lib/watch/service";

export const runtime = "nodejs";

const requestSchema = z.object({
  nonceId: z.string().uuid(),
  nonce: z.string().min(16).max(64),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(
    "auth-wallet",
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
  const { nonceId, nonce, address, signature } = parsed.data;

  const nonceOk = await consumeWalletNonce(nonceId, nonce);
  if (!nonceOk) return errors.badRequest("Invalid or expired nonce.");

  const message = `永铭 Evermark 登录 / Sign in to Evermark\n\nNonce: ${nonce}`;
  const recovered = recoverPersonalSignAddress(message, signature);
  if (!recovered || recovered !== address.toLowerCase()) {
    return errors.badRequest("Signature verification failed.");
  }

  const user = await findOrCreateUserByWallet(recovered);
  // Signing in is proof of life: cancel any watch escalation in progress.
  await resetWatchesOnActivity(user.id);
  const token = await createSessionToken(user.id);
  const res = NextResponse.json({
    data: { user: { id: user.id, email: user.email, wallet: user.wallet } },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
