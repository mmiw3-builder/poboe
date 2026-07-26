import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, ok } from "@/lib/api/respond";
import { userFromRequest } from "@/lib/auth/session";
import { creditRecharge } from "@/lib/billing/engine";
import { clientKeyFromHeaders, rateLimit } from "@/lib/moderation/rateLimit";

export const runtime = "nodejs";

const MIN_USD = 5;
const MAX_USD = 10_000;

const requestSchema = z.object({
  amountUsd: z.number().min(MIN_USD).max(MAX_USD),
});

/**
 * Start a recharge. With STRIPE_SECRET_KEY configured this creates a Stripe
 * Checkout session (crediting happens in the webhook); in development
 * without Stripe it credits the balance directly as a simulated top-up.
 */
export async function POST(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return errors.unauthorized();

  const limited = rateLimit(
    "recharge",
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
  if (!parsed.success) {
    return errors.badRequest(`Amount must be between $${MIN_USD} and $${MAX_USD}.`);
  }
  const amountUsd = Math.round(parsed.data.amountUsd * 100) / 100;
  const cents = Math.round(amountUsd * 100);

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    if (process.env.NODE_ENV === "production") {
      return errors.internal("Payments are not configured (STRIPE_SECRET_KEY).");
    }
    await creditRecharge(
      user.id,
      cents * 10_000,
      `dev-${crypto.randomUUID()}`,
      "simulated recharge (dev mode)",
    );
    return ok({ simulated: true });
  }

  const origin = req.nextUrl.origin;
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]":
      "Evermark permanent storage credit",
    "line_items[0][price_data][unit_amount]": String(cents),
    "line_items[0][quantity]": "1",
    success_url: `${origin}/space/recharge?status=success`,
    cancel_url: `${origin}/space/recharge?status=cancelled`,
    client_reference_id: user.id,
    "metadata[userId]": user.id,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    signal: AbortSignal.timeout(15000),
  });
  const json = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !json.url) {
    console.error("stripe session failed:", json.error?.message);
    return errors.internal("Could not start the payment session.");
  }
  return ok({ url: json.url });
}
