import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Operational state only. The permanence promise lives on-chain — accounts,
 * balances and activity timers are replaceable conveniences: even if this
 * database vanished, every memorial would remain readable.
 */

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email"),
    wallet: text("wallet"),
    displayName: text("display_name"),
    createdAt: integer("created_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
    /** Last gentle journal-reminder email, for monthly throttling. */
    lastNudgeAt: integer("last_nudge_at"),
    /** Last remembrance-digest email, for weekly throttling. */
    lastDigestAt: integer("last_digest_at"),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_wallet_idx").on(t.wallet),
  ],
);

export const authCodes = sqliteTable("auth_codes", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  consumedAt: integer("consumed_at"),
  createdAt: integer("created_at").notNull(),
});

export const walletNonces = sqliteTable("wallet_nonces", {
  id: text("id").primaryKey(),
  nonce: text("nonce").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** Money ledger in micro-USD (1e-6 USD) integers — never floats. */
export const ledger = sqliteTable("ledger", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  deltaMicroUsd: integer("delta_micro_usd").notNull(),
  kind: text("kind", {
    enum: ["recharge", "spend", "grant", "refund"],
  }).notNull(),
  /** External reference: stripe session id, irys txId, … */
  ref: text("ref"),
  note: text("note"),
  createdAt: integer("created_at").notNull(),
});

/** Storage allowance accounting, in bytes (free tier + purchased bundles). */
export const usage = sqliteTable("usage", {
  userId: text("user_id").primaryKey(),
  freeBytesUsed: integer("free_bytes_used").notNull().default(0),
  /** Extra allowance from one-time bundle purchases (永恒套餐). */
  grantedBytes: integer("granted_bytes").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

/** Which account created/owns which memorial. */
export const userMemorials = sqliteTable(
  "user_memorials",
  {
    userId: text("user_id").notNull(),
    memorialId: text("memorial_id").notNull(),
    /** Stamped from the manifest at publish: living | deceased. */
    subjectStatus: text("subject_status"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("user_memorials_idx").on(t.userId, t.memorialId)],
);

/**
 * Account custody of space management keys, so signing in on any device is
 * enough — the traditional-app experience. Secrets are AES-256-GCM
 * encrypted at rest; users who prefer full self-custody can download a
 * backup and delete the custodied copy.
 */
export const memorialKeys = sqliteTable(
  "memorial_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    memorialId: text("memorial_id").notNull(),
    publicKey: text("public_key").notNull(),
    nonce: text("nonce").notNull(),
    name: text("name").notNull().default(""),
    encryptedSecretKey: text("encrypted_secret_key").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("memorial_keys_memorial_idx").on(t.memorialId)],
);

/**
 * Sliding-window rate-limit events for money-sensitive paths (the site
 * wallet pays for storage). Shared across serverless instances, unlike the
 * in-memory limiter that guards the cheap paths.
 */
export const rateEvents = sqliteTable(
  "rate_events",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("rate_events_key_idx").on(t.key, t.createdAt)],
);

/**
 * Dead-man's-switch config for living archives. State machine:
 * active → overdue (inactivity exceeded, owner notified)
 *        → pending_confirm (contact asked to confirm)
 *        → cooling (confirmed; 30-day cooling period, owner can veto)
 *        → transitioned (memorial switched to deceased display)
 */
export const watches = sqliteTable("watches", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  memorialId: text("memorial_id").notNull(),
  inactivityDays: integer("inactivity_days").notNull(),
  contactEmail: text("contact_email").notNull(),
  state: text("state", {
    enum: ["active", "overdue", "pending_confirm", "cooling", "transitioned", "disabled"],
  }).notNull(),
  confirmToken: text("confirm_token"),
  coolingEndsAt: integer("cooling_ends_at"),
  lastNotifiedAt: integer("last_notified_at"),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
});
