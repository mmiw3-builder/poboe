import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, ok } from "@/lib/api/respond";
import { publicKeyOf } from "@/lib/crypto";
import { getAppTag } from "@/lib/irys/config";
import { fetchTxJson, queryTransactions } from "@/lib/irys/query";
import { uploadJson } from "@/lib/irys/server";
import { signModerationRecord } from "@/lib/memorial/identity";
import {
  SCHEMA_MODERATION,
  TAGS,
  type Report,
} from "@/lib/memorial/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

import { timingSafeEqual } from "node:crypto";

function authorize(req: NextRequest): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(given);
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}

const actionSchema = z.object({
  action: z.enum(["hide", "unhide"]),
  targetType: z.enum(["memorial", "tribute", "contribution"]),
  targetId: z.string().min(1).max(100),
  reason: z.string().max(500).optional(),
});

/**
 * Admin: publish a signed hide/unhide record. The underlying data stays on
 * the permanent network (it cannot be deleted); this only controls what this
 * site renders — and the moderation log itself is public and auditable.
 */
export async function POST(req: NextRequest) {
  if (!authorize(req)) return errors.unauthorized();
  const secret = process.env.MODERATION_ADMIN_SECRET;
  if (!secret) {
    return errors.internal("MODERATION_ADMIN_SECRET is not configured.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errors.badRequest("Expected JSON.");
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid moderation action.");

  const record = signModerationRecord(
    {
      schemaId: SCHEMA_MODERATION,
      ...parsed.data,
      createdAt: Date.now(),
      adminPubKey: publicKeyOf(secret),
    },
    secret,
  );

  try {
    const result = await uploadJson(record, [
      { name: TAGS.appName, value: getAppTag() },
      { name: TAGS.type, value: "moderation" },
    ]);
    return ok({ txId: result.id });
  } catch (err) {
    console.error("moderation upload failed:", err);
    return errors.internal("Failed to publish the moderation record.");
  }
}

/** Admin: list recent reports to act on. */
export async function GET(req: NextRequest) {
  if (!authorize(req)) return errors.unauthorized();

  const page = await queryTransactions({
    tags: [
      { name: TAGS.appName, values: [getAppTag()] },
      { name: TAGS.type, values: ["report"] },
    ],
    first: 50,
    order: "DESC",
    revalidate: 0,
  });
  const reports = await Promise.all(
    page.nodes.map(async (n) => ({
      txId: n.id,
      report: await fetchTxJson<Report>(n.id),
    })),
  );
  return ok({ reports: reports.filter((r) => r.report) });
}
