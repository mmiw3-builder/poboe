import Link from "next/link";
import MemoryWall, { type WallPerson } from "@/components/wall/MemoryWall";
import { getDictionary, getLocale } from "@/i18n/server";
import { gatewayUrlFor } from "@/lib/irys/config";
import { listMemorials } from "@/lib/memorial/repo";

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  permanent: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
      <path
        strokeLinecap="round"
        d="M12 3v2m0 14v2M5.6 5.6l1.4 1.4m9.9 9.9 1.4 1.4M3 12h2m14 0h2M5.6 18.4 7 17m9.9-9.9 1.4-1.4"
      />
      <circle cx="12" cy="12" r="4" />
    </svg>
  ),
  open: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" />
    </svg>
  ),
  free: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s-7.5-4.7-9.3-9.6C1.3 7.6 3.8 4.5 7 4.5c2 0 3.7 1.1 5 2.9 1.3-1.8 3-2.9 5-2.9 3.2 0 5.7 3.1 4.3 6.9C19.5 16.3 12 21 12 21Z"
      />
    </svg>
  ),
};

export default async function Home() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  let people: WallPerson[] = [];
  try {
    const { items } = await listMemorials({ limit: 60 });
    people = items.map(({ manifest }) => ({
      id: manifest.id,
      name: manifest.subject.name,
      altName: manifest.subject.altName,
      born: manifest.subject.born,
      died: manifest.subject.died,
      epitaph: manifest.subject.epitaph,
      portraitUrl: manifest.subject.portrait
        ? gatewayUrlFor(manifest.subject.portrait.txId)
        : undefined,
    }));
  } catch {
    // The wall renders with vacant tiles even if the index is unreachable.
  }

  return (
    <main className="flex flex-1 flex-col">
      {/* Slim hero */}
      <section className="halo relative flex flex-col items-center px-4 pb-12 pt-16 text-center sm:pt-20">
        <p className="mb-5 text-xs uppercase tracking-[0.35em] text-accent">
          {t.common.permanentStorage}
        </p>
        <h1 className="max-w-3xl font-serif text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl">
          {t.home.heroTitle}
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-muted sm:text-base">
          {t.home.heroSubtitle}
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/create"
            className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-7 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-strong"
          >
            {t.home.ctaCreate}
          </Link>
          <Link
            href="/explore"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border px-7 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
          >
            {t.home.ctaExplore}
          </Link>
        </div>
      </section>

      {/* The Wall of Memory */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="font-serif text-2xl font-semibold sm:text-3xl">
              {t.wall.title}
            </h2>
            <p className="mt-2 text-sm text-muted">{t.wall.subtitle}</p>
          </div>
          <MemoryWall people={people} />
          {people.length > 0 && (
            <div className="mt-10 text-center">
              <Link
                href="/explore"
                className="text-sm text-accent underline-offset-4 hover:underline"
              >
                {t.wall.viewAll} →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3">
          {(Object.keys(t.home.features) as Array<keyof typeof t.home.features>).map(
            (key) => (
              <div key={key} className="flex flex-col items-center text-center md:items-start md:text-left">
                <div className="mb-4 text-accent">{FEATURE_ICONS[key]}</div>
                <h2 className="font-serif text-xl font-semibold">
                  {t.home.features[key].title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {t.home.features[key].body}
                </p>
              </div>
            ),
          )}
        </div>
      </section>
    </main>
  );
}
