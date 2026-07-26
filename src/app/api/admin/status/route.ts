import type { NextRequest } from "next/server";
import { errors, ok } from "@/lib/api/respond";
import { getUploaderStatus } from "@/lib/irys/server";

export const runtime = "nodejs";

/** Admin: server wallet address, network, balance and current price per MB. */
export async function GET(req: NextRequest) {
  const token = process.env.ADMIN_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) {
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
