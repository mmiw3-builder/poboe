import { NextResponse, type NextRequest } from "next/server";
import { ok } from "@/lib/api/respond";
import {
  SESSION_COOKIE,
  userFromRequest,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await userFromRequest(req);
  return ok({ user });
}

/** Logout. */
export async function DELETE() {
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
