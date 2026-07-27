import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, ok } from "@/lib/api/respond";
import { recoverPersonalSignAddress } from "@/lib/auth/ethsig";
import {
  bindWallet,
  consumeWalletNonce,
  walletInUse,
} from "@/lib/auth/service";
import { userFromRequest } from "@/lib/auth/session";
import { clientKeyFromHeaders, rateLimit } from "@/lib/moderation/rateLimit";

export const runtime = "nodejs";

const requestSchema = z.object({
  nonceId: z.string().uuid(),
  nonce: z.string().min(16).max(64),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
});

/** Bind a wallet to a signed-in (email-only) account. */
export async function POST(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return errors.unauthorized();
  if (user.wallet) return errors.badRequest("A wallet is already bound.");

  const limited = rateLimit(
    "link-wallet",
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
  const { nonceId, nonce, address, signature } = parsed.data;

  const nonceOk = await consumeWalletNonce(nonceId, nonce);
  if (!nonceOk) return errors.badRequest("Invalid or expired nonce.");

  const message = `永铭 Evermark 登录 / Sign in to Evermark\n\nNonce: ${nonce}`;
  const recovered = recoverPersonalSignAddress(message, signature);
  if (!recovered || recovered !== address.toLowerCase()) {
    return errors.badRequest("Signature verification failed.");
  }

  // Never merge accounts: an identity in use elsewhere cannot be bound.
  if (await walletInUse(recovered)) {
    return errors.badRequest("identity_in_use");
  }
  await bindWallet(user.id, recovered);
  return ok({ bound: true });
}
