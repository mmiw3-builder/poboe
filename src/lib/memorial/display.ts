import type { SubjectStatus } from "./schema";

/**
 * Date line shown under a person's name, shared by every surface (page,
 * cards, wall tiles). Living subjects never show a closing date — the line
 * reads "born — present" in the viewer's language.
 */
export function lifeDates(
  subject: { born?: string; died?: string; status?: SubjectStatus },
  presentLabel: string,
): string {
  if (subject.status === "living") {
    return subject.born ? `${subject.born} — ${presentLabel}` : "";
  }
  return [subject.born, subject.died].filter(Boolean).join(" — ");
}
