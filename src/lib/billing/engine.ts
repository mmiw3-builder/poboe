import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Usage-based billing in integer micro-USD. Storage is priced per byte with
 * a per-account free allowance applied first. All mutations run inside a
 * transaction; balances are ledger sums (append-only, auditable).
 */

export const PRICE_PER_MB_MICRO_USD = 20_000; // $0.02 per MB
export const FREE_ALLOWANCE_BYTES = 10 * 1024 * 1024; // 10 MB per account
const MB = 1024 * 1024;

export class InsufficientBalanceError extends Error {
  constructor(
    public required: number,
    public balance: number,
  ) {
    super("insufficient balance");
  }
}

export function costForBytes(chargedBytes: number): number {
  if (chargedBytes <= 0) return 0;
  return Math.ceil((chargedBytes * PRICE_PER_MB_MICRO_USD) / MB);
}

export async function getBalanceMicroUsd(userId: string): Promise<number> {
  const rows = await db()
    .select({
      total: sql<number>`coalesce(sum(${schema.ledger.deltaMicroUsd}), 0)`,
    })
    .from(schema.ledger)
    .where(eq(schema.ledger.userId, userId));
  return rows[0]?.total ?? 0;
}

export async function getFreeBytesRemaining(userId: string): Promise<number> {
  const rows = await db()
    .select()
    .from(schema.usage)
    .where(eq(schema.usage.userId, userId))
    .limit(1);
  const used = rows[0]?.freeBytesUsed ?? 0;
  return Math.max(0, FREE_ALLOWANCE_BYTES - used);
}

export interface Quote {
  bytes: number;
  freeBytesApplied: number;
  chargedBytes: number;
  costMicroUsd: number;
  balanceMicroUsd: number;
  sufficient: boolean;
}

export async function quoteBytes(
  userId: string,
  bytes: number,
): Promise<Quote> {
  const [freeRemaining, balance] = await Promise.all([
    getFreeBytesRemaining(userId),
    getBalanceMicroUsd(userId),
  ]);
  const freeBytesApplied = Math.min(bytes, freeRemaining);
  const chargedBytes = bytes - freeBytesApplied;
  const costMicroUsd = costForBytes(chargedBytes);
  return {
    bytes,
    freeBytesApplied,
    chargedBytes,
    costMicroUsd,
    balanceMicroUsd: balance,
    sufficient: balance >= costMicroUsd,
  };
}

export interface ChargeResult {
  freeBytesApplied: number;
  costMicroUsd: number;
}

/** Atomically consume free allowance and deduct the remainder from balance. */
export async function chargeBytes(
  userId: string,
  bytes: number,
  ref: string,
  note: string,
): Promise<ChargeResult> {
  return db().transaction(async (tx) => {
    const usageRows = await tx
      .select()
      .from(schema.usage)
      .where(eq(schema.usage.userId, userId))
      .limit(1);
    const used = usageRows[0]?.freeBytesUsed ?? 0;
    const freeRemaining = Math.max(0, FREE_ALLOWANCE_BYTES - used);
    const freeBytesApplied = Math.min(bytes, freeRemaining);
    const chargedBytes = bytes - freeBytesApplied;
    const costMicroUsd = costForBytes(chargedBytes);

    if (costMicroUsd > 0) {
      const balRows = await tx
        .select({
          total: sql<number>`coalesce(sum(${schema.ledger.deltaMicroUsd}), 0)`,
        })
        .from(schema.ledger)
        .where(eq(schema.ledger.userId, userId));
      const balance = balRows[0]?.total ?? 0;
      if (balance < costMicroUsd) {
        throw new InsufficientBalanceError(costMicroUsd, balance);
      }
      await tx.insert(schema.ledger).values({
        id: crypto.randomUUID(),
        userId,
        deltaMicroUsd: -costMicroUsd,
        kind: "spend",
        ref,
        note,
        createdAt: Date.now(),
      });
    }

    if (freeBytesApplied > 0) {
      if (usageRows[0]) {
        await tx
          .update(schema.usage)
          .set({
            freeBytesUsed: used + freeBytesApplied,
            updatedAt: Date.now(),
          })
          .where(eq(schema.usage.userId, userId));
      } else {
        await tx.insert(schema.usage).values({
          userId,
          freeBytesUsed: freeBytesApplied,
          updatedAt: Date.now(),
        });
      }
    }

    return { freeBytesApplied, costMicroUsd };
  });
}

/** Undo a charge when the paid-for upload failed afterwards. */
export async function refundCharge(
  userId: string,
  charge: ChargeResult,
  ref: string,
  note: string,
): Promise<void> {
  await db().transaction(async (tx) => {
    if (charge.costMicroUsd > 0) {
      await tx.insert(schema.ledger).values({
        id: crypto.randomUUID(),
        userId,
        deltaMicroUsd: charge.costMicroUsd,
        kind: "refund",
        ref,
        note,
        createdAt: Date.now(),
      });
    }
    if (charge.freeBytesApplied > 0) {
      const rows = await tx
        .select()
        .from(schema.usage)
        .where(eq(schema.usage.userId, userId))
        .limit(1);
      if (rows[0]) {
        await tx
          .update(schema.usage)
          .set({
            freeBytesUsed: Math.max(
              0,
              rows[0].freeBytesUsed - charge.freeBytesApplied,
            ),
            updatedAt: Date.now(),
          })
          .where(eq(schema.usage.userId, userId));
      }
    }
  });
}

export async function creditRecharge(
  userId: string,
  amountMicroUsd: number,
  ref: string,
  note: string,
): Promise<void> {
  await db().insert(schema.ledger).values({
    id: crypto.randomUUID(),
    userId,
    deltaMicroUsd: amountMicroUsd,
    kind: "recharge",
    ref,
    note,
    createdAt: Date.now(),
  });
}

export function formatUsd(microUsd: number): string {
  return `$${(microUsd / 1_000_000).toFixed(2)}`;
}
