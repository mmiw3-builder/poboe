/**
 * Sliding-window rate limiter, in-memory per server instance.
 *
 * Serverless note: on Vercel each warm instance keeps its own window, so the
 * effective global limit is (limit x instances). Combined with hard size
 * caps this is an adequate MVP deterrent; swap `store` for a shared KV
 * (Upstash/Vercel KV) when traffic justifies it.
 */

const store = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
let lastSweep = 0;

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

/** Best-effort client identity behind proxies/CDN. */
export function clientKeyFromHeaders(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
