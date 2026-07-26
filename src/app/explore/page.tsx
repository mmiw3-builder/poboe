import type { Metadata } from "next";
import Link from "next/link";
import MemorialCard from "@/components/memorial/MemorialCard";
import { getDictionary, getLocale } from "@/i18n/server";
import { listMemorials } from "@/lib/memorial/repo";

export const runtime = "nodejs";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.explore.title, description: t.explore.subtitle };
}

export default async function ExplorePage(props: PageProps<"/explore">) {
  const search = await props.searchParams;
  const q = typeof search.q === "string" ? search.q.trim() : "";
  const after = typeof search.after === "string" ? search.after : null;

  const t = getDictionary(await getLocale());
  const { items, endCursor, hasNextPage } = await listMemorials({
    limit: 24,
    after,
  });

  const query = q.toLowerCase();
  const visible = query
    ? items.filter((item) => {
        const s = item.manifest.subject;
        return (
          s.name.toLowerCase().includes(query) ||
          s.altName?.toLowerCase().includes(query)
        );
      })
    : items;

  return (
    <main className="flex-1 pb-20">
      <section className="halo px-4 pb-10 pt-16 text-center">
        <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
          {t.explore.title}
        </h1>
        <p className="mt-3 text-sm text-muted">{t.explore.subtitle}</p>
        <form className="mx-auto mt-8 max-w-sm" action="/explore" method="get">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t.explore.searchPlaceholder}
            className="input rounded-full px-5 text-center"
          />
        </form>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        {visible.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted">
              {q ? t.explore.noResult : t.explore.empty}
            </p>
            {!q && (
              <Link href="/create" className="btn-primary mt-8 inline-flex">
                {t.explore.beFirst}
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item) => (
              <MemorialCard key={item.manifest.id} manifest={item.manifest} />
            ))}
          </div>
        )}

        {hasNextPage && endCursor && !q && (
          <div className="mt-10 text-center">
            <Link
              href={`/explore?after=${encodeURIComponent(endCursor)}`}
              className="btn-outline inline-flex"
            >
              {t.explore.loadMore}
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
