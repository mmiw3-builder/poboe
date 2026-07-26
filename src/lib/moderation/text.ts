/**
 * Pre-upload text moderation. Permanent storage cannot be deleted, so the
 * only reliable enforcement point is BEFORE funding an upload.
 *
 * Three layers:
 *  1. blocklist of clearly-unacceptable terms (starter set — extend freely);
 *  2. structural spam heuristics (link farms, repetition);
 *  3. optional external moderation API (MODERATION_API_URL) for real
 *     production-grade classification.
 */

export interface ModerationVerdict {
  ok: boolean;
  /** Machine-readable reasons, e.g. ["blocked-term", "too-many-links"] */
  reasons: string[];
}

/**
 * Starter blocklist. Deliberately conservative: memorial pages legitimately
 * discuss death, war and illness, so only terms with no legitimate memorial
 * use belong here. Case-insensitive substring match.
 */
const BLOCKED_TERMS: string[] = [
  // Sexual content involving minors — zero tolerance.
  "child porn",
  "childporn",
  "cp资源",
  "幼女",
  "萝莉资源",
  // Doxxing / harassment markers.
  "人肉搜索",
  "开盒",
  // Scam / illegal-trade markers that have no place on a memorial.
  "代开发票",
  "办证刻章",
  "枪支弹药",
  "赌博网站",
  "六合彩",
  "私彩平台",
  "银行卡四件套",
  "买卖身份证",
  "致幻剂购买",
  "冰毒",
  "海洛因",
];

const URL_PATTERN = /https?:\/\/|www\./gi;

export function checkTextLocal(text: string): ModerationVerdict {
  const reasons: string[] = [];
  const lowered = text.toLowerCase();

  for (const term of BLOCKED_TERMS) {
    if (lowered.includes(term.toLowerCase())) {
      reasons.push("blocked-term");
      break;
    }
  }

  const linkCount = (text.match(URL_PATTERN) ?? []).length;
  if (linkCount > 3) reasons.push("too-many-links");

  // Long runs of one repeated character are a spam signature.
  if (/(.)\1{49,}/s.test(text)) reasons.push("repetition-spam");

  return { ok: reasons.length === 0, reasons };
}

/**
 * Optional external classifier. Set MODERATION_API_URL to a service that
 * accepts POST {"text": "..."} and answers {"flagged": boolean}.
 * Fails closed on errors? No — fails OPEN with a logged warning, so a dead
 * third-party service cannot take memorial publishing down; the local
 * layers above still apply.
 */
async function checkTextExternal(text: string): Promise<ModerationVerdict> {
  const url = process.env.MODERATION_API_URL;
  if (!url) return { ok: true, reasons: [] };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.MODERATION_API_KEY
          ? { Authorization: `Bearer ${process.env.MODERATION_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = (await res.json()) as { flagged?: boolean };
    return json.flagged
      ? { ok: false, reasons: ["external-flagged"] }
      : { ok: true, reasons: [] };
  } catch (err) {
    console.warn("moderation API unavailable, continuing with local checks:", err);
    return { ok: true, reasons: [] };
  }
}

/** Moderate all user-supplied text fields as one document. */
export async function moderateText(
  fields: Array<string | undefined>,
): Promise<ModerationVerdict> {
  const combined = fields.filter(Boolean).join("\n");
  if (!combined.trim()) return { ok: true, reasons: [] };

  const local = checkTextLocal(combined);
  if (!local.ok) return local;
  return checkTextExternal(combined);
}
