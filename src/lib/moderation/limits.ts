/**
 * Anti-abuse limits for the server-paid upload model. Storage costs are
 * borne by the site wallet, so every byte a user can push must be bounded.
 * Request bodies must also stay under Vercel's ~4.5 MB serverless limit.
 */
export const LIMITS = {
  /** Per uploaded image (client compresses before upload). */
  maxImageBytes: 3_500_000,
  /** Per uploaded video clip. Larger videos need the delegated-payment path (future). */
  maxVideoBytes: 3_500_000,
  /** Gallery size per memorial. */
  maxMediaCount: 12,
  maxManifestBytes: 100_000,
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  allowedVideoTypes: ["video/mp4", "video/webm"],
  /** Sliding-window rate limits, per client IP. */
  uploadsPerHour: 40,
  publishesPerHour: 10,
  tributesPerHour: 30,
  reportsPerHour: 10,
} as const;

export function isAllowedMediaType(
  contentType: string,
): "image" | "video" | null {
  if ((LIMITS.allowedImageTypes as readonly string[]).includes(contentType)) {
    return "image";
  }
  if ((LIMITS.allowedVideoTypes as readonly string[]).includes(contentType)) {
    return "video";
  }
  return null;
}
