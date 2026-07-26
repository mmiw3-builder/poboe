import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, ok } from "@/lib/api/respond";
import { composeBio } from "@/lib/ai/composeBio";
import { clientKeyFromHeaders, rateLimit } from "@/lib/moderation/rateLimit";
import { moderateText } from "@/lib/moderation/text";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  name: z.string().min(1).max(120),
  lang: z.enum(["zh", "en"]),
  answers: z
    .array(
      z.object({
        question: z.string().min(1).max(300),
        answer: z.string().max(2000),
      }),
    )
    .min(1)
    .max(10),
});

/** Guided-interview bio drafting. Nothing is stored — the draft goes back to the client editor. */
export async function POST(req: NextRequest) {
  const limited = rateLimit(
    "compose",
    clientKeyFromHeaders(req.headers),
    20,
  );
  if (!limited.allowed) return errors.rateLimited();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errors.badRequest("Expected JSON.");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid interview payload.");

  const { name, lang, answers } = parsed.data;
  const filled = answers.filter((a) => a.answer.trim());
  if (filled.length === 0) {
    return errors.badRequest("At least one answer is required.");
  }

  const verdict = await moderateText([name, ...filled.map((a) => a.answer)]);
  if (!verdict.ok) return errors.rejected(verdict.reasons);

  const result = await composeBio(name, filled, lang);
  return ok(result);
}
