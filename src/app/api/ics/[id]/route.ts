import type { NextRequest } from "next/server";
import { errors } from "@/lib/api/respond";
import { getMemorial } from "@/lib/memorial/repo";

export const runtime = "nodejs";

/**
 * Anniversary calendar: yearly recurring all-day events for the birthday
 * and memorial day. Only fully-specified dates (YYYY-MM-DD) produce events.
 */

function icsEscape(s: string): string {
  return s
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

function yearlyEvent(
  uid: string,
  date: string,
  summary: string,
): string[] {
  const compact = date.replaceAll("-", "");
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${compact}T000000Z`,
    `DTSTART;VALUE=DATE:${compact}`,
    "RRULE:FREQ=YEARLY",
    `SUMMARY:${icsEscape(summary)}`,
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
}

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/ics/[id]">,
) {
  const { id } = await ctx.params;
  const result = await getMemorial(id);
  if (!result) return errors.notFound("Memorial not found.");
  const { subject } = result.manifest;
  const zh = (result.manifest.lang ?? "zh") === "zh";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//poboe-evermark//memorial//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsEscape(zh ? `纪念 ${subject.name}` : `In memory of ${subject.name}`)}`,
  ];

  if (subject.bornDate && FULL_DATE.test(subject.bornDate)) {
    lines.push(
      ...yearlyEvent(
        `born-${id}@poboe-evermark`,
        subject.bornDate,
        zh ? `${subject.name} 诞辰` : `Birthday of ${subject.name}`,
      ),
    );
  }
  if (subject.diedDate && FULL_DATE.test(subject.diedDate)) {
    lines.push(
      ...yearlyEvent(
        `died-${id}@poboe-evermark`,
        subject.diedDate,
        zh ? `${subject.name} 忌日` : `In memory of ${subject.name}`,
      ),
    );
  }
  lines.push("END:VCALENDAR");

  if (lines.length <= 6) {
    return errors.notFound("No anniversary dates on this memorial.");
  }

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="evermark-${id}.ics"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
