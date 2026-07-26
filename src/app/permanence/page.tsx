import type { Metadata } from "next";
import PermanenceVerifier from "@/components/permanence/PermanenceVerifier";
import { getDictionary, getLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.permanence.title };
}

export default async function PermanencePage(
  props: PageProps<"/permanence">,
) {
  const t = getDictionary(await getLocale());
  const params = await props.searchParams;
  const initialId = typeof params.id === "string" ? params.id : undefined;

  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-2xl px-4 pb-20 sm:px-6">
        <div className="halo pt-16 text-center">
          <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
            {t.permanence.title}
          </h1>
          <p className="mt-3 text-sm text-muted">{t.permanence.subtitle}</p>
        </div>

        <p className="mt-8 text-sm leading-7 text-foreground/85">
          {t.permanence.intro}
        </p>

        <section className="mt-10">
          <h2 className="font-serif text-xl font-semibold">
            {t.permanence.how.title}
          </h2>
          <ol className="mt-4 space-y-4">
            {[
              t.permanence.how.p1,
              t.permanence.how.p2,
              t.permanence.how.p3,
            ].map((p, i) => (
              <li key={i} className="flex gap-4 text-sm leading-7 text-foreground/85">
                <span
                  className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/50 font-serif text-xs text-accent"
                  aria-hidden
                >
                  {i + 1}
                </span>
                {p}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10">
          <PermanenceVerifier initialId={initialId} />
        </section>

        <section className="mt-10 rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-serif text-xl font-semibold">
            {t.permanence.diy.title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            {t.permanence.diy.body}
          </p>
        </section>
      </div>
    </main>
  );
}
