import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { errors, ok } from "@/lib/api/respond";
import { advanceWatches, sendJournalNudges } from "@/lib/watch/service";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily watch sweep, invoked by Vercel Cron (vercel.json) which sends
 * `Authorization: Bearer ${CRON_SECRET}`. Without CRON_SECRET configured
 * the sweep only runs in development.
 */
function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const given = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(given);
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return errors.unauthorized();
  const [watch, nudge] = [
    await advanceWatches(req.nextUrl.origin),
    await sendJournalNudges(req.nextUrl.origin),
  ];
  return ok({ ...watch, ...nudge });
}
