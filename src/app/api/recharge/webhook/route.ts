import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { errors, ok } from "@/lib/api/respond";
import { creditRecharge } from "@/lib/billing/engine";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

/** Verify Stripe's signature header (t=...,v1=...) over the raw body. */
function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header) return false;
  const parts = new Map(
    header.split(",").map((p) => p.split("=") as [string, string]),
  );
  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !v1) return false;
  // Reject stale events (5 minutes).
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(`${t}.${payload}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return errors.internal("STRIPE_WEBHOOK_SECRET not configured.");

  const payload = await req.text();
  if (
    !verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)
  ) {
    return errors.unauthorized();
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: {
      object: {
        id: string;
        amount_total?: number;
        metadata?: { userId?: string };
        client_reference_id?: string;
      };
    };
  };

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId ?? session.client_reference_id;
    const cents = session.amount_total ?? 0;
    if (userId && cents > 0) {
      // Idempotency: skip if this checkout session was already credited.
      const existing = await db()
        .select({ id: schema.ledger.id })
        .from(schema.ledger)
        .where(eq(schema.ledger.ref, session.id))
        .limit(1);
      if (!existing[0]) {
        await creditRecharge(
          userId,
          cents * 10_000,
          session.id,
          `stripe recharge $${(cents / 100).toFixed(2)}`,
        );
      }
    }
  }

  return ok({ received: true });
}
