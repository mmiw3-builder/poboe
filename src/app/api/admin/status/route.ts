import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { errors, ok } from "@/lib/api/respond";
import { getUploaderStatus } from "@/lib/irys/server";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Admin: server wallet address, network, balance and current price per MB. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return errors.unauthorized();
  }
  try {
    return ok(await getUploaderStatus());
  } catch (err) {
    console.error("status failed:", err);
    return errors.internal(
      err instanceof Error ? err.message : "Status unavailable.",
    );
  }
}
