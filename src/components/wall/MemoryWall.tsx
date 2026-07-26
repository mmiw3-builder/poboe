"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";

/**
 * The Wall of Memory — the homepage centerpiece. Every tile is a person.
 * Three densities (overview / cozy / detail), a quick-view lightbox with
 * prev/next flipping, and vacant tiles inviting creation when the wall
 * is still young.
 */

export interface WallPerson {
  id: string;
  name: string;
  altName?: string;
  born?: string;
  died?: string;
  epitaph?: string;
  portraitUrl?: string;
}

type Density = "overview" | "comfortable" | "detail";

/** Deterministic personal hue: the same person always gets the same color. */
function hueOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

function tileGradient(id: string): string {
  const h = hueOf(id);
  return `linear-gradient(140deg, hsl(${h} 30% 46%), hsl(${(h + 24) % 360} 34% 24%))`;
}

const GRID_CLASS: Record<Density, string> = {
  overview:
    "grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(76px,1fr))]",
  comfortable:
    "grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(128px,1fr))]",
  detail:
    "grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]",
};

const MIN_TILES = 18;

export default function MemoryWall({ people }: { people: WallPerson[] }) {
  const { t } = useI18n();
  const [density, setDensity] = useState<Density>("comfortable");
  const [selected, setSelected] = useState<number | null>(null);

  const close = useCallback(() => setSelected(null), []);
  const step = useCallback(
    (delta: number) => {
      setSelected((cur) => {
        if (cur === null || people.length === 0) return cur;
        return (cur + delta + people.length) % people.length;
      });
    },
    [people.length],
  );

  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [selected, close, step]);

  const vacantCount = Math.max(0, MIN_TILES - people.length);
  const person = selected !== null ? people[selected] : null;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {t.wall.remembered}{" "}
          <span className="font-serif text-lg text-accent">{people.length}</span>{" "}
          {t.wall.people}
        </p>
        <div
          className="flex items-center rounded-full border border-border p-1"
          role="group"
          aria-label="density"
        >
          {(
            [
              ["overview", t.wall.density.overview],
              ["comfortable", t.wall.density.comfortable],
              ["detail", t.wall.density.detail],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDensity(key)}
              className={`rounded-full px-4 py-1.5 text-xs transition-colors ${
                density === key
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* The wall */}
      <div className={`grid ${GRID_CLASS[density]}`}>
        {people.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(i)}
            className="tile-in group relative block w-full text-left"
            style={{ "--i": i } as React.CSSProperties}
            aria-label={p.name}
          >
            <span className="relative block aspect-square w-full overflow-hidden rounded-lg ring-1 ring-border transition duration-300 group-hover:z-10 group-hover:scale-[1.06] group-hover:shadow-lg group-hover:ring-accent/70">
              {p.portraitUrl ? (
                <Image
                  src={p.portraitUrl}
                  alt={p.name}
                  fill
                  sizes={density === "overview" ? "80px" : "200px"}
                  className="object-cover"
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center font-serif text-[38%] leading-none text-white/90"
                  style={{
                    background: tileGradient(p.id),
                    fontSize:
                      density === "overview" ? "1.4rem" : "2.2rem",
                  }}
                >
                  {p.name.slice(0, 1)}
                </span>
              )}
              {/* Hover veil with name (not in overview) */}
              {density !== "overview" && (
                <span className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-6 text-[11px] leading-tight text-white opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  {p.name}
                </span>
              )}
            </span>
            {density === "detail" && (
              <span className="mt-2 block text-center">
                <span className="block truncate font-serif text-sm font-semibold">
                  {p.name}
                </span>
                {(p.born || p.died) && (
                  <span className="block text-[11px] tracking-wider text-muted">
                    {[p.born, p.died].filter(Boolean).join(" — ")}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}

        {/* Vacant tiles */}
        {Array.from({ length: vacantCount }).map((_, i) => (
          <Link
            key={`vacant-${i}`}
            href="/create"
            className="tile-in group block"
            style={{ "--i": people.length + i } as React.CSSProperties}
            aria-label={t.wall.placeholderHint}
          >
            <span className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted/50 transition duration-300 group-hover:border-accent/60 group-hover:text-accent">
              <span className="text-xl leading-none">+</span>
              {density !== "overview" && (
                <span className="px-1 text-center text-[10px]">
                  {t.wall.placeholder}
                </span>
              )}
            </span>
            {density === "detail" && <span className="mt-2 block">&nbsp;</span>}
          </Link>
        ))}
      </div>

      {/* Quick view lightbox */}
      {person && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={person.name}
        >
          <button
            type="button"
            aria-label={t.wall.close}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />
          <div className="modal-in relative w-full max-w-md rounded-3xl border border-border bg-background p-8 text-center shadow-2xl">
            <button
              type="button"
              aria-label={t.wall.close}
              onClick={close}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-halo hover:text-foreground"
            >
              ✕
            </button>

            <span className="relative mx-auto block h-32 w-32 overflow-hidden rounded-full ring-1 ring-accent/60 ring-offset-4 ring-offset-background">
              {person.portraitUrl ? (
                <Image
                  src={person.portraitUrl}
                  alt={person.name}
                  fill
                  sizes="8rem"
                  className="object-cover"
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center font-serif text-5xl text-white/90"
                  style={{ background: tileGradient(person.id) }}
                >
                  {person.name.slice(0, 1)}
                </span>
              )}
            </span>

            <h3 className="mt-6 font-serif text-2xl font-semibold">
              {person.name}
            </h3>
            {person.altName && (
              <p className="mt-1 font-serif text-sm text-muted">
                {person.altName}
              </p>
            )}
            {(person.born || person.died) && (
              <p className="mt-2 text-xs tracking-[0.2em] text-muted">
                {[person.born, person.died].filter(Boolean).join(" — ")}
              </p>
            )}
            {person.epitaph && (
              <p className="mt-5 font-serif text-base italic leading-relaxed text-foreground/85">
                「{person.epitaph}」
              </p>
            )}

            <Link href={`/m/${person.id}`} className="btn-primary mt-7 inline-flex">
              {t.wall.quickVisit}
            </Link>

            <div className="mt-6 flex items-center justify-between text-xs text-muted">
              <button
                type="button"
                onClick={() => step(-1)}
                className="flex items-center gap-1 transition-colors hover:text-accent"
              >
                ← {t.wall.prev}
              </button>
              <span>
                {(selected ?? 0) + 1} / {people.length}
              </span>
              <button
                type="button"
                onClick={() => step(1)}
                className="flex items-center gap-1 transition-colors hover:text-accent"
              >
                {t.wall.next} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
