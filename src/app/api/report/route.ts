import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, ok } from "@/lib/api/respond";
import { getAppTag } from "@/lib/irys/config";
import { uploadJson } from "@/lib/irys/server";
import { SCHEMA_REPORT, TAGS, type Report } from "@/lib/memorial/schema";
import { LIMITS } from "@/lib/moderation/limits";
import { clientKeyFromHeaders, rateLimit } from "@/lib/moderation/rateLimit";

export const runtime = "nodejs";

const requestSchema = z.object({
  targetType: z.enum(["memorial", "tribute"]),
  targetId: z.string().min(1).max(100),
  reason: z.string().min(1).max(1000),
});

/**
 * Public reporting endpoint. Reports are stored as records the admin can
 * query and act on with a signed hide record. The chain keeps the audit trail.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(
    "report",
    clientKeyFromHeaders(req.headers),
    LIMITS.reportsPerHour,
  );
  if (!limited.allowed) return errors.rateLimited();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errors.badRequest("Expected JSON.");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid report.");

  const report: Report = {
    schemaId: SCHEMA_REPORT,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    reason: parsed.data.reason.trim(),
    createdAt: Date.now(),
  };

  try {
    const result = await uploadJson(report, [
      { name: TAGS.appName, value: getAppTag() },
      { name: TAGS.type, value: "report" },
    ]);
    return ok({ txId: result.id });
  } catch (err) {
    console.error("report upload failed:", err);
    return errors.internal("Failed to submit the report.");
  }
}
