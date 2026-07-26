import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function Home() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl">{t.home.heroTitle}</h1>
      <p className="max-w-xl text-center text-sm opacity-70">
        {t.home.heroSubtitle}
      </p>
      <LanguageSwitcher />
    </main>
  );
}
