import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, ok } from "@/lib/api/respond";
import { userFromRequest } from "@/lib/auth/session";
import {
  PRICE_PER_MB_MICRO_USD,
  getAllowance,
  getBalanceMicroUsd,
  quoteBytes,
} from "@/lib/billing/engine";

export const runtime = "nodejs";

/** Account billing summary. */
export async function GET(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return errors.unauthorized();
  const [balanceMicroUsd, allowance] = await Promise.all([
    getBalanceMicroUsd(user.id),
    getAllowance(user.id),
  ]);
  return ok({
    balanceMicroUsd,
    freeBytesRemaining: allowance.remainingBytes,
    freeAllowanceBytes: allowance.totalBytes,
    pricePerMbMicroUsd: PRICE_PER_MB_MICRO_USD,
  });
}

const quoteSchema = z.object({
  bytes: z.number().int().nonnegative().max(1_000_000_000),
});

/** Quote a pending publish before the user commits. */
export async function POST(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return errors.unauthorized();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errors.badRequest("Expected JSON.");
  }
  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid quote request.");
  return ok(await quoteBytes(user.id, parsed.data.bytes));
}
