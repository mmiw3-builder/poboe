import { and, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { sha256 } from "@noble/hashes/sha2.js";
import { db, schema } from "@/lib/db";
import { bytesToBase64Url, utf8ToBytes } from "@/lib/codec";
import { publicKeyOf } from "@/lib/crypto";
import { getAppTag } from "@/lib/irys/config";
import { uploadJson } from "@/lib/irys/server";
import { signTransitionRecord } from "@/lib/memorial/identity";
import { SCHEMA_TRANSITION, TAGS } from "@/lib/memorial/schema";
import { sendMail } from "@/lib/mail";

/**
 * The watch (守望) mechanism — a dead-man's switch for living archives.
 *
 *   active          owner signs in often enough; nothing happens
 *   overdue         inactivity exceeded; the owner is emailed and has a
 *                   grace window to simply sign in
 *   pending_confirm grace passed; the trusted contact gets a confirm link
 *   cooling         contact confirmed; 30 days during which any owner
 *                   sign-in (or visit with a live session) vetoes
 *   transitioned    an admin-signed transition record is published
 *                   on-chain and the page becomes a memorial
 *
 * Any sign-in during overdue/pending_confirm/cooling resets to active.
 */

export const GRACE_DAYS = 14;
export const COOLING_DAYS = 30;
export const INACTIVITY_CHOICES = [30, 90, 180, 365] as const;
/** Gentle journal reminder: after this much quiet, at most monthly. */
export const NUDGE_AFTER_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

function hashToken(raw: string): string {
  return bytesToBase64Url(sha256(utf8ToBytes(`watch:${raw}`)));
}

async function ownsMemorial(
  userId: string,
  memorialId: string,
): Promise<boolean> {
  const rows = await db()
    .select({ memorialId: schema.userMemorials.memorialId })
    .from(schema.userMemorials)
    .where(
      and(
        eq(schema.userMemorials.userId, userId),
        eq(schema.userMemorials.memorialId, memorialId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export interface WatchConfigInput {
  memorialId: string;
  enabled: boolean;
  inactivityDays: number;
  contactEmail: string;
}

export class WatchError extends Error {
  constructor(public code: "not_owner" | "invalid_config") {
    super(code);
  }
}

export async function upsertWatch(
  userId: string,
  input: WatchConfigInput,
): Promise<void> {
  if (!(await ownsMemorial(userId, input.memorialId))) {
    throw new WatchError("not_owner");
  }
  if (
    input.enabled &&
    (!INACTIVITY_CHOICES.includes(
      input.inactivityDays as (typeof INACTIVITY_CHOICES)[number],
    ) ||
      !input.contactEmail.includes("@"))
  ) {
    throw new WatchError("invalid_config");
  }

  const now = Date.now();
  const existing = await db()
    .select()
    .from(schema.watches)
    .where(
      and(
        eq(schema.watches.userId, userId),
        eq(schema.watches.memorialId, input.memorialId),
      ),
    )
    .limit(1);

  const state = input.enabled ? "active" : "disabled";
  if (existing[0]) {
    await db()
      .update(schema.watches)
      .set({
        inactivityDays: input.inactivityDays,
        contactEmail: input.contactEmail.trim(),
        state,
        confirmToken: null,
        coolingEndsAt: null,
        lastNotifiedAt: null,
        updatedAt: now,
      })
      .where(eq(schema.watches.id, existing[0].id));
  } else {
    await db().insert(schema.watches).values({
      id: crypto.randomUUID(),
      userId,
      memorialId: input.memorialId,
      inactivityDays: input.inactivityDays,
      contactEmail: input.contactEmail.trim(),
      state,
      confirmToken: null,
      coolingEndsAt: null,
      lastNotifiedAt: null,
      updatedAt: now,
      createdAt: now,
    });
  }
}

export interface WatchListItem {
  memorialId: string;
  state: string | null;
  inactivityDays: number | null;
  contactEmail: string | null;
  coolingEndsAt: number | null;
  updatedAt: number | null;
}

/** Every memorial the account owns, with its watch config when present. */
export async function listWatches(userId: string): Promise<WatchListItem[]> {
  const rows = await db()
    .select({
      memorialId: schema.userMemorials.memorialId,
      watch: schema.watches,
    })
    .from(schema.userMemorials)
    .leftJoin(
      schema.watches,
      and(
        eq(schema.watches.memorialId, schema.userMemorials.memorialId),
        eq(schema.watches.userId, schema.userMemorials.userId),
      ),
    )
    .where(eq(schema.userMemorials.userId, userId));
  return rows.map((row) => ({
    memorialId: row.memorialId,
    state: row.watch?.state ?? null,
    inactivityDays: row.watch?.inactivityDays ?? null,
    contactEmail: row.watch?.contactEmail ?? null,
    coolingEndsAt: row.watch?.coolingEndsAt ?? null,
    updatedAt: row.watch?.updatedAt ?? null,
  }));
}

/** Sign-in (or any authenticated visit) is proof of life: escalations reset. */
export async function resetWatchesOnActivity(userId: string): Promise<void> {
  await db()
    .update(schema.watches)
    .set({
      state: "active",
      confirmToken: null,
      coolingEndsAt: null,
      lastNotifiedAt: null,
      updatedAt: Date.now(),
    })
    .where(
      and(
        eq(schema.watches.userId, userId),
        inArray(schema.watches.state, [
          "overdue",
          "pending_confirm",
          "cooling",
        ]),
      ),
    );
}

/** Trusted contact clicked the confirm link: begin the cooling period. */
export async function confirmWatch(
  rawToken: string,
): Promise<{ ok: boolean; coolingEndsAt?: number }> {
  const rows = await db()
    .select()
    .from(schema.watches)
    .where(
      and(
        eq(schema.watches.confirmToken, hashToken(rawToken)),
        eq(schema.watches.state, "pending_confirm"),
      ),
    )
    .limit(1);
  const watch = rows[0];
  if (!watch) return { ok: false };

  const now = Date.now();
  const coolingEndsAt = now + COOLING_DAYS * DAY_MS;
  await db()
    .update(schema.watches)
    .set({
      state: "cooling",
      confirmToken: null,
      coolingEndsAt,
      lastNotifiedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.watches.id, watch.id));

  const owner = await db()
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, watch.userId))
    .limit(1);
  if (owner[0]?.email) {
    await sendMail(
      owner[0].email,
      "永铭 Evermark：守望确认已收到 / Watch confirmation received",
      `您的守望联系人确认了状态变更。空间 ${watch.memorialId} 将在 ${COOLING_DAYS} 天冷静期后转为纪念模式。若这是误会，只需在此期间登录一次即可撤销。\n\nYour watch contact confirmed a status change. Space ${watch.memorialId} will become a memorial after a ${COOLING_DAYS}-day cooling period. If this is a mistake, simply sign in once during this period to cancel.`,
    );
  }
  return { ok: true, coolingEndsAt };
}

/**
 * A soft habit loop for living archives, entirely separate from the watch
 * escalation: owners of a living space who have been quiet for a month get
 * one warm "come write a moment" email, at most monthly. Users whose watch
 * is already escalating are skipped — their inbox has weightier mail.
 */
export async function sendJournalNudges(
  baseUrl: string,
): Promise<{ nudged: number }> {
  const now = Date.now();
  const cutoff = now - NUDGE_AFTER_DAYS * DAY_MS;

  const rows = await db()
    .selectDistinct({
      id: schema.users.id,
      email: schema.users.email,
    })
    .from(schema.users)
    .innerJoin(
      schema.userMemorials,
      eq(schema.userMemorials.userId, schema.users.id),
    )
    .where(
      and(
        eq(schema.userMemorials.subjectStatus, "living"),
        isNotNull(schema.users.email),
        lt(schema.users.lastSeenAt, cutoff),
        or(
          isNull(schema.users.lastNudgeAt),
          lt(schema.users.lastNudgeAt, cutoff),
        ),
      ),
    );

  let nudged = 0;
  for (const row of rows) {
    if (!row.email) continue;
    const escalated = await db()
      .select({ id: schema.watches.id })
      .from(schema.watches)
      .where(
        and(
          eq(schema.watches.userId, row.id),
          inArray(schema.watches.state, [
            "overdue",
            "pending_confirm",
            "cooling",
          ]),
        ),
      )
      .limit(1);
    if (escalated[0]) continue;

    await sendMail(
      row.email,
      "永铭 Evermark：来写一段时光吧 / Come write a moment",
      `好久不见。你的「人生进行时」空间已经安静了一段时间——生活值得被记下，一句话、一张照片，都会被永久保存。\n${baseUrl}/space\n\nIt's been a while. Your life-in-progress space has been quiet — life is worth writing down, and a line or a photo is kept forever.\n${baseUrl}/space`,
    );
    await db()
      .update(schema.users)
      .set({ lastNudgeAt: now })
      .where(eq(schema.users.id, row.id));
    nudged += 1;
  }
  return { nudged };
}

export interface SweepResult {
  checked: number;
  toOverdue: number;
  toPendingConfirm: number;
  toTransitioned: number;
  vetoed: number;
}

/**
 * The daily cron sweep. Advances every enabled watch one step at most.
 * baseUrl is the deployment origin used to build confirm links.
 */
export async function advanceWatches(baseUrl: string): Promise<SweepResult> {
  const now = Date.now();
  const result: SweepResult = {
    checked: 0,
    toOverdue: 0,
    toPendingConfirm: 0,
    toTransitioned: 0,
    vetoed: 0,
  };

  const rows = await db()
    .select({
      watch: schema.watches,
      lastSeenAt: schema.users.lastSeenAt,
      email: schema.users.email,
    })
    .from(schema.watches)
    .innerJoin(schema.users, eq(schema.users.id, schema.watches.userId))
    .where(
      inArray(schema.watches.state, [
        "active",
        "overdue",
        "pending_confirm",
        "cooling",
      ]),
    );

  for (const { watch, lastSeenAt, email } of rows) {
    result.checked += 1;

    // Owner veto: seen after the escalation began → back to active.
    if (watch.state !== "active" && lastSeenAt > watch.updatedAt) {
      await db()
        .update(schema.watches)
        .set({
          state: "active",
          confirmToken: null,
          coolingEndsAt: null,
          lastNotifiedAt: null,
          updatedAt: now,
        })
        .where(eq(schema.watches.id, watch.id));
      result.vetoed += 1;
      continue;
    }

    if (watch.state === "active") {
      if (now - lastSeenAt <= watch.inactivityDays * DAY_MS) continue;
      await db()
        .update(schema.watches)
        .set({ state: "overdue", lastNotifiedAt: now, updatedAt: now })
        .where(eq(schema.watches.id, watch.id));
      result.toOverdue += 1;
      if (email) {
        await sendMail(
          email,
          "永铭 Evermark：请登录确认平安 / Please sign in to confirm you're well",
          `您已超过 ${watch.inactivityDays} 天未访问永铭。为避免守望机制误触发，请在 ${GRACE_DAYS} 天内登录一次；否则我们将请您的守望联系人协助确认。\n\nYou haven't visited Evermark in over ${watch.inactivityDays} days. Please sign in within ${GRACE_DAYS} days, or we will ask your watch contact to help confirm your status.`,
        );
      }
      continue;
    }

    if (watch.state === "overdue") {
      const notified = watch.lastNotifiedAt ?? watch.updatedAt;
      if (now - notified <= GRACE_DAYS * DAY_MS) continue;
      const rawToken = crypto.randomUUID().replaceAll("-", "");
      await db()
        .update(schema.watches)
        .set({
          state: "pending_confirm",
          confirmToken: hashToken(rawToken),
          lastNotifiedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.watches.id, watch.id));
      result.toPendingConfirm += 1;
      await sendMail(
        watch.contactEmail,
        "永铭 Evermark：一位亲友托付您确认 / A loved one asked you to confirm",
        `一位使用永铭 Evermark 的用户将您设为守望联系人。TA 已长时间未登录，我们无法确认 TA 的状况。\n若 TA 确实已经离世，请打开以下链接确认；确认后仍有 ${COOLING_DAYS} 天冷静期，期间 TA 本人登录即可撤销：\n${baseUrl}/watch/confirm?token=${rawToken}\n\n若 TA 一切安好，请忽略本邮件，并提醒 TA 登录一次。\n\nAn Evermark user named you as their watch contact. They haven't signed in for a long time and we cannot confirm their status.\nIf they have passed away, please confirm at the link above. A ${COOLING_DAYS}-day cooling period follows, during which their own sign-in cancels everything.\nIf they are fine, ignore this email and remind them to sign in.`,
      );
      continue;
    }

    // pending_confirm waits for the contact; cooling waits for its deadline.
    if (watch.state === "cooling") {
      if (!watch.coolingEndsAt || now < watch.coolingEndsAt) continue;
      const secret = process.env.MODERATION_ADMIN_SECRET;
      if (!secret) {
        console.warn("watch sweep: MODERATION_ADMIN_SECRET missing, retry later");
        continue;
      }
      try {
        const record = signTransitionRecord(
          {
            schemaId: SCHEMA_TRANSITION,
            memorialId: watch.memorialId,
            toStatus: "deceased",
            reason: "watch_confirmed",
            createdAt: now,
            adminPubKey: publicKeyOf(secret),
          },
          secret,
        );
        await uploadJson(record, [
          { name: TAGS.appName, value: getAppTag() },
          { name: TAGS.type, value: "transition" },
          { name: TAGS.memorialId, value: watch.memorialId },
        ]);
      } catch (err) {
        // Upload failed — stay in cooling and retry on the next sweep.
        console.error("watch sweep: transition upload failed", err);
        continue;
      }
      await db()
        .update(schema.watches)
        .set({ state: "transitioned", lastNotifiedAt: now, updatedAt: now })
        .where(eq(schema.watches.id, watch.id));
      result.toTransitioned += 1;
      await sendMail(
        watch.contactEmail,
        "永铭 Evermark：空间已转为纪念模式 / The space is now a memorial",
        `冷静期已结束，空间 ${watch.memorialId} 已转为纪念模式，永久铭记。\n\nThe cooling period has ended. Space ${watch.memorialId} is now displayed as a memorial, permanently remembered.`,
      );
      if (email) {
        await sendMail(
          email,
          "永铭 Evermark：空间已转为纪念模式 / The space is now a memorial",
          `空间 ${watch.memorialId} 的守望流程已完成，页面已转为纪念模式。\n\nThe watch process for space ${watch.memorialId} is complete; the page now displays as a memorial.`,
        );
      }
    }
  }
  return result;
}
