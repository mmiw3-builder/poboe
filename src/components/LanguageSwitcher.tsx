"use client";

import { useI18n } from "@/i18n/client";

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const next = locale === "zh" ? "en" : "zh";

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      className="text-sm underline-offset-4 hover:underline"
      aria-label={locale === "zh" ? "Switch to English" : "切换为中文"}
    >
      {locale === "zh" ? "EN" : "中文"}
    </button>
  );
}
