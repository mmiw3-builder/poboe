import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const SESSION_COOKIE = "poboe_auth";
const SESSION_DAYS = 30;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (s) return new TextEncoder().encode(s);
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production.");
  }
  return new TextEncoder().encode("poboe-dev-secret-not-for-production");
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.uid === "string" ? payload.uid : null;
  } catch {
    return null;
  }
}

export interface SessionUser {
  id: string;
  email: string | null;
  wallet: string | null;
  displayName: string | null;
}

async function loadUser(userId: string): Promise<SessionUser | null> {
  const rows = await db()
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  const u = rows[0];
  if (!u) return null;
  // Touch activity (throttled to once per hour) — feeds the watch mechanism.
  const now = Date.now();
  if (now - u.lastSeenAt > 60 * 60 * 1000) {
    void db()
      .update(schema.users)
      .set({ lastSeenAt: now })
      .where(eq(schema.users.id, userId))
      .catch(() => {});
  }
  return {
    id: u.id,
    email: u.email,
    wallet: u.wallet,
    displayName: u.displayName,
  };
}

/** Session from an API route request. */
export async function userFromRequest(
  req: NextRequest,
): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const uid = await verifyToken(token);
  return uid ? loadUser(uid) : null;
}

/** Session from a server component (cookies()). */
export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const uid = await verifyToken(token);
  return uid ? loadUser(uid) : null;
}
