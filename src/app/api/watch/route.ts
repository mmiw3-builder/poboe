import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, ok } from "@/lib/api/respond";
import { userFromRequest } from "@/lib/auth/session";
import {
  INACTIVITY_CHOICES,
  WatchError,
  listWatches,
  upsertWatch,
} from "@/lib/watch/service";

export const runtime = "nodejs";

const configSchema = z.object({
  memorialId: z.string().min(10).max(40).regex(/^[A-Za-z0-9_-]+$/),
  enabled: z.boolean(),
  inactivityDays: z.number().int().positive(),
  contactEmail: z.string().max(200),
});

/** Watch configs for every memorial this account owns. */
export async function GET(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return errors.unauthorized();
  const items = await listWatches(user.id);
  return ok({ items, choices: INACTIVITY_CHOICES });
}

export async function POST(req: NextRequest) {
  const user = await userFromRequest(req);
  if (!user) return errors.unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errors.badRequest("Expected JSON.");
  }
  const parsed = configSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid watch config.");
  if (
    parsed.data.enabled &&
    !z.string().email().safeParse(parsed.data.contactEmail).success
  ) {
    return errors.badRequest("A valid contact email is required.");
  }

  try {
    await upsertWatch(user.id, parsed.data);
  } catch (err) {
    if (err instanceof WatchError) {
      return err.code === "not_owner"
        ? errors.unauthorized()
        : errors.badRequest("Invalid watch config.");
    }
    throw err;
  }
  return ok({ saved: true });
}
