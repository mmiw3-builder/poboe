/**
 * Transactional email via Resend's REST API. Returns false (never throws)
 * when unconfigured or on any transport error — every caller must treat
 * email as best-effort.
 */
export async function sendMail(
  to: string,
  subject: string,
  text: string,
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[mail:dev] to=${to} subject=${subject}\n${text}`);
    }
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Evermark <noreply@evermark.example>",
        to: [to],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
