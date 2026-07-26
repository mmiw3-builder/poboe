import { getAppTag } from "../irys/config";
import { fetchTxJson, queryTransactions, tagValue } from "../irys/query";
import { publicKeyOf } from "../crypto";
import { verifyManifest, verifyModerationRecord } from "./identity";
import {
  TAGS,
  memorialManifestSchema,
  moderationRecordSchema,
  tributeSchema,
  type MemorialManifest,
  type ModerationRecord,
  type Tribute,
} from "./schema";

/**
 * Read path: everything the site renders is queried from the Irys index,
 * validated against the zod schemas and cryptographically verified before
 * it is trusted. Records that fail verification are silently dropped.
 */

function baseTags(type: "memorial" | "tribute" | "moderation" | "report") {
  return [
    { name: TAGS.appName, values: [getAppTag()] },
    { name: TAGS.type, values: [type] },
  ];
}

export function getAdminPublicKey(): string | null {
  const secret = process.env.MODERATION_ADMIN_SECRET;
  if (!secret) return null;
  try {
    return publicKeyOf(secret);
  } catch {
    return null;
  }
}

export interface ModerationState {
  hiddenMemorials: Set<string>;
  hiddenTributes: Set<string>;
}

/** Replay signed hide/unhide records (oldest first) into the current state. */
export async function getModerationState(): Promise<ModerationState> {
  const state: ModerationState = {
    hiddenMemorials: new Set(),
    hiddenTributes: new Set(),
  };
  const adminPubKey = getAdminPublicKey();
  if (!adminPubKey) return state;

  const page = await queryTransactions({
    tags: baseTags("moderation"),
    first: 100,
    order: "ASC",
    revalidate: 30,
  });
  const records = await Promise.all(
    page.nodes.map((n) => fetchTxJson<ModerationRecord>(n.id)),
  );
  for (const raw of records) {
    const parsed = moderationRecordSchema.safeParse(raw);
    if (!parsed.success) continue;
    if (!verifyModerationRecord(parsed.data, adminPubKey)) continue;
    const set =
      parsed.data.targetType === "memorial"
        ? state.hiddenMemorials
        : state.hiddenTributes;
    if (parsed.data.action === "hide") set.add(parsed.data.targetId);
    else set.delete(parsed.data.targetId);
  }
  return state;
}

async function fetchManifest(txId: string): Promise<MemorialManifest | null> {
  const raw = await fetchTxJson(txId);
  const parsed = memorialManifestSchema.safeParse(raw);
  if (!parsed.success) return null;
  return verifyManifest(parsed.data) ? parsed.data : null;
}

/** Latest valid version of one memorial, or null if unknown/hidden. */
export async function getMemorial(
  id: string,
  opts: { includeHidden?: boolean } = {},
): Promise<{ manifest: MemorialManifest; txId: string } | null> {
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(id)) return null;

  const [page, moderation] = await Promise.all([
    queryTransactions({
      tags: [...baseTags("memorial"), { name: TAGS.memorialId, values: [id] }],
      first: 50,
      order: "DESC",
      revalidate: 15,
    }),
    opts.includeHidden ? null : getModerationState(),
  ]);
  if (moderation?.hiddenMemorials.has(id)) return null;

  const manifests = await Promise.all(
    page.nodes.map(async (n) => ({
      manifest: await fetchManifest(n.id),
      txId: n.id,
    })),
  );
  let best: { manifest: MemorialManifest; txId: string } | null = null;
  for (const entry of manifests) {
    if (!entry.manifest || entry.manifest.id !== id) continue;
    if (!best || entry.manifest.version > best.manifest.version) {
      best = { manifest: entry.manifest, txId: entry.txId };
    }
  }
  return best;
}

export interface MemorialListItem {
  manifest: MemorialManifest;
  txId: string;
}

/**
 * Newest memorials for the explore/home pages. Deduplicates by memorial id,
 * keeping the newest transaction per id (good enough for listing cards).
 */
export async function listMemorials(options: {
  limit?: number;
  after?: string | null;
} = {}): Promise<{
  items: MemorialListItem[];
  endCursor: string | null;
  hasNextPage: boolean;
}> {
  const limit = options.limit ?? 24;
  const [page, moderation] = await Promise.all([
    queryTransactions({
      tags: baseTags("memorial"),
      first: Math.min(limit * 2, 100),
      after: options.after ?? null,
      order: "DESC",
      revalidate: 30,
    }),
    getModerationState(),
  ]);

  const seen = new Set<string>();
  const candidates: { txId: string; memorialId: string }[] = [];
  for (const node of page.nodes) {
    const memorialId = tagValue(node, TAGS.memorialId);
    if (!memorialId || seen.has(memorialId)) continue;
    if (moderation.hiddenMemorials.has(memorialId)) continue;
    seen.add(memorialId);
    candidates.push({ txId: node.id, memorialId });
  }

  const manifests = await Promise.all(
    candidates.map(async ({ txId, memorialId }) => {
      const manifest = await fetchManifest(txId);
      return manifest && manifest.id === memorialId
        ? { manifest, txId }
        : null;
    }),
  );

  return {
    items: manifests.filter((x): x is MemorialListItem => x !== null).slice(0, limit),
    endCursor: page.endCursor,
    hasNextPage: page.hasNextPage,
  };
}

export interface TributeItem {
  tribute: Tribute;
  txId: string;
}

export async function listTributes(
  memorialId: string,
  options: { limit?: number; after?: string | null } = {},
): Promise<{
  items: TributeItem[];
  counts: { flower: number; candle: number; message: number };
  endCursor: string | null;
  hasNextPage: boolean;
}> {
  const [page, moderation] = await Promise.all([
    queryTransactions({
      tags: [
        ...baseTags("tribute"),
        { name: TAGS.memorialId, values: [memorialId] },
      ],
      first: options.limit ?? 100,
      after: options.after ?? null,
      order: "DESC",
      revalidate: 10,
    }),
    getModerationState(),
  ]);

  const items: TributeItem[] = [];
  const counts = { flower: 0, candle: 0, message: 0 };
  const parsed = await Promise.all(
    page.nodes.map(async (node) => {
      if (moderation.hiddenTributes.has(node.id)) return null;
      const raw = await fetchTxJson(node.id);
      const result = tributeSchema.safeParse(raw);
      if (!result.success || result.data.memorialId !== memorialId) return null;
      return { tribute: result.data, txId: node.id };
    }),
  );
  for (const item of parsed) {
    if (!item) continue;
    items.push(item);
    counts[item.tribute.kind] += 1;
  }
  return {
    items,
    counts,
    endCursor: page.endCursor,
    hasNextPage: page.hasNextPage,
  };
}
