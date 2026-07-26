import { cookies, headers } from "next/headers";
import {
  LOCALE_COOKIE,
  isLocale,
  matchAcceptLanguage,
  type Locale,
} from "./config";
import zh, { type Dictionary } from "./dictionaries/zh";
import en from "./dictionaries/en";

const dictionaries: Record<Locale, Dictionary> = { zh, en };

/**
 * Resolve the current locale on the server: explicit cookie choice first,
 * then the browser's Accept-Language header.
 */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const saved = cookieStore.get(LOCALE_COOKIE)?.value;
  if (saved && isLocale(saved)) return saved;

  const headerStore = await headers();
  return matchAcceptLanguage(headerStore.get("accept-language"));
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
