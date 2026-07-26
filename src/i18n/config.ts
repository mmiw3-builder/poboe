export const locales = ["zh", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Cookie that persists the user's explicit language choice. */
export const LOCALE_COOKIE = "poboe_locale";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Pick the best locale from an Accept-Language header value. */
export function matchAcceptLanguage(header: string | null): Locale {
  if (!header) return defaultLocale;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    if (tag.startsWith("zh")) return "zh";
    if (tag.startsWith("en")) return "en";
  }
  return defaultLocale;
}
