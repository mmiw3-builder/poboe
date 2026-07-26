import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function fail(
  status: number,
  code: string,
  message: string,
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export const errors = {
  badRequest: (msg: string) => fail(400, "bad_request", msg),
  unauthorized: () => fail(401, "unauthorized", "Unauthorized"),
  notFound: (msg = "Not found") => fail(404, "not_found", msg),
  tooLarge: (msg: string) => fail(413, "too_large", msg),
  unsupported: (msg: string) => fail(415, "unsupported_type", msg),
  rateLimited: () =>
    fail(429, "rate_limited", "Too many requests — please try again later."),
  rejected: (reasons: string[]) =>
    fail(
      422,
      "content_rejected",
      `Content failed moderation: ${reasons.join(", ")}`,
    ),
  internal: (msg = "Internal error") => fail(500, "internal", msg),
};
