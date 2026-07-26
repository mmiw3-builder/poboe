import { z } from "zod";

/**
 * On-chain record schemas. Every record is a JSON document uploaded to Irys
 * with query tags; these zod schemas are the single source of truth for
 * validation on both API and read paths.
 */

export const SCHEMA_MEMORIAL = "poboe/memorial@1";
export const SCHEMA_TRIBUTE = "poboe/tribute@1";
export const SCHEMA_MODERATION = "poboe/moderation@1";
export const SCHEMA_REPORT = "poboe/report@1";
export const SCHEMA_CONTRIBUTION = "poboe/contribution@1";

/** Irys tag names/values used to index records. */
export const TAGS = {
  appName: "App-Name",
  /** Distinct per network so devnet experiments never leak into mainnet reads. */
  appValue: "poboe-evermark",
  type: "Type",
  memorialId: "Memorial-Id",
  contentType: "Content-Type",
} as const;

export type RecordType =
  | "memorial"
  | "tribute"
  | "moderation"
  | "report"
  | "contribution";

const base64Url = /^[A-Za-z0-9_-]+$/;

export const mediaRefSchema = z.object({
  txId: z.string().min(1).max(100).regex(base64Url),
  kind: z.enum(["image", "video", "audio"]),
  contentType: z.string().min(1).max(100),
  caption: z.string().max(300).optional(),
  size: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export type MediaRef = z.infer<typeof mediaRefSchema>;

/** One entry of the life timeline, freeform era + title. */
export const lifeEventSchema = z.object({
  year: z.string().min(1).max(20),
  title: z.string().min(1).max(120),
  detail: z.string().max(1000).optional(),
});

export type LifeEvent = z.infer<typeof lifeEventSchema>;

/** Partial ISO date: YYYY, YYYY-MM or YYYY-MM-DD. */
const partialIsoDate = /^\d{4}(-\d{2}(-\d{2})?)?$/;

export const memorialManifestSchema = z.object({
  schemaId: z.literal(SCHEMA_MEMORIAL),
  /** Derived from ownerPubKey + nonce — see identity.ts */
  id: z.string().min(10).max(40).regex(base64Url),
  nonce: z.string().min(8).max(64),
  /** base64url Ed25519 public key (32 bytes) */
  ownerPubKey: z.string().min(40).max(50).regex(base64Url),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  /** Monotonically increasing per update; highest valid version wins. */
  version: z.number().int().positive(),
  lang: z.string().max(10).optional(),
  subject: z.object({
    name: z.string().min(1).max(120),
    altName: z.string().max(120).optional(),
    born: z.string().max(40).optional(),
    died: z.string().max(40).optional(),
    /**
     * Structured dates powering anniversary reminders (.ics). Optional and
     * WITHOUT defaults: adding defaults would inject fields into older
     * parsed manifests and break their signatures.
     */
    bornDate: z.string().regex(partialIsoDate).optional(),
    diedDate: z.string().regex(partialIsoDate).optional(),
    epitaph: z.string().max(200).optional(),
    bio: z.string().max(20000).optional(),
    portrait: mediaRefSchema.optional(),
    /** Voice legacy — a short audio clip of the person. */
    voice: mediaRefSchema.optional(),
  }),
  media: z.array(mediaRefSchema).max(30).default([]),
  /** Life timeline. Optional, no default (signature compatibility). */
  events: z.array(lifeEventSchema).max(50).optional(),
  /**
   * txIds of visitor contributions the owner has approved for display.
   * Optional, no default (signature compatibility).
   */
  approvedContributions: z.array(z.string().min(1).max(100)).max(200).optional(),
  tributesEnabled: z.boolean().default(true),
  /** base64url Ed25519 signature over the canonical manifest without `sig`. */
  sig: z.string().min(80).max(100).regex(base64Url),
});

export type MemorialManifest = z.infer<typeof memorialManifestSchema>;
export type UnsignedMemorialManifest = Omit<MemorialManifest, "sig">;

export const tributeSchema = z.object({
  schemaId: z.literal(SCHEMA_TRIBUTE),
  memorialId: z.string().min(10).max(40).regex(base64Url),
  kind: z.enum(["flower", "candle", "message"]),
  message: z.string().max(1000).optional(),
  name: z.string().max(60).optional(),
  createdAt: z.number().int().positive(),
});

export type Tribute = z.infer<typeof tributeSchema>;

export const moderationRecordSchema = z.object({
  schemaId: z.literal(SCHEMA_MODERATION),
  action: z.enum(["hide", "unhide"]),
  targetType: z.enum(["memorial", "tribute", "contribution"]),
  /** memorialId for memorials, Irys txId for tributes */
  targetId: z.string().min(1).max(100),
  reason: z.string().max(500).optional(),
  createdAt: z.number().int().positive(),
  adminPubKey: z.string().min(40).max(50).regex(base64Url),
  sig: z.string().min(80).max(100).regex(base64Url),
});

export type ModerationRecord = z.infer<typeof moderationRecordSchema>;

export const contributionSchema = z.object({
  schemaId: z.literal(SCHEMA_CONTRIBUTION),
  memorialId: z.string().min(10).max(40).regex(base64Url),
  /** Contributor's display name. */
  name: z.string().max(60).optional(),
  /** Relationship to the person, e.g. 老同事 / colleague. */
  relation: z.string().max(60).optional(),
  story: z.string().min(1).max(2000),
  createdAt: z.number().int().positive(),
});

export type Contribution = z.infer<typeof contributionSchema>;

export const reportSchema = z.object({
  schemaId: z.literal(SCHEMA_REPORT),
  targetType: z.enum(["memorial", "tribute", "contribution"]),
  targetId: z.string().min(1).max(100),
  reason: z.string().min(1).max(1000),
  createdAt: z.number().int().positive(),
});

export type Report = z.infer<typeof reportSchema>;
