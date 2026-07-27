import { and, eq, gt, lte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Two-tier sliding-window rate limiting.
 *
 * `rateLimit` — in-memory per server instance. Fine for cheap paths
 * (tributes, reports, auth attempts): on Vercel the effective global limit
 * is (limit x warm instances), an acceptable deterrent.
 *
 * `rateLimitPersistent` — database-backed, shared across all instances.
 * Required on money paths (uploads, publishes, entries) where every
 * request spends the site wallet's storage funds. Falls back to the
 * in-memory limiter if the database is unreachable (fail-open beats
 * blocking grieving users; hard size caps still bound the damage).
 */

const store = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
let lastSweep = 0;
let lastDbSweep = 0;

export function rateLimit(
  bucket: string,
  clientKey: string,
  limit: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  sweep(now);
  const key = `${bucket}:${clientKey}`;
  const hits = (store.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= limit) {
    store.set(key, hits);
    return { allowed: false, remaining: 0 };
  }
  hits.push(now);
  store.set(key, hits);
  return { allowed: true, remaining: limit - hits.length };
}

function sweep(now: number) {
  if (now - lastSweep < 10 * 60 * 1000) return;
  lastSweep = now;
  for (const [key, hits] of store) {
    const live = hits.filter((t) => now - t < WINDOW_MS);
    if (live.length === 0) store.delete(key);
    else store.set(key, live);
  }
}

/** Instance-shared limiter for paths that spend the site wallet's funds. */
export async function rateLimitPersistent(
  bucket: string,
  clientKey: string,
  limit: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const key = `${bucket}:${clientKey}`;
  try {
    const rows = await db()
      .select({ count: sql<number>`count(*)` })
      .from(schema.rateEvents)
      .where(
        and(
          eq(schema.rateEvents.key, key),
          gt(schema.rateEvents.createdAt, now - WINDOW_MS),
        ),
      );
    const count = rows[0]?.count ?? 0;
    if (count >= limit) return { allowed: false, remaining: 0 };
    await db().insert(schema.rateEvents).values({
      id: crypto.randomUUID(),
      key,
      createdAt: now,
    });
    // Opportunistic cleanup, at most every 10 minutes per instance.
    if (now - lastDbSweep > 10 * 60 * 1000) {
      lastDbSweep = now;
      await db()
        .delete(schema.rateEvents)
        .where(lte(schema.rateEvents.createdAt, now - 2 * WINDOW_MS))
        .catch(() => {});
    }
    return { allowed: true, remaining: limit - count - 1 };
  } catch {
    return rateLimit(bucket, clientKey, limit);
  }
}

/** Best-effort client identity behind proxies/CDN. */
export function clientKeyFromHeaders(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
