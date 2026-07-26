"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/client";
import { lifeDates } from "@/lib/memorial/display";
import type {
  LifeEvent,
  MediaRef,
  SubjectStatus,
} from "@/lib/memorial/schema";

/**
 * Shared presentational memorial ("digital gravestone"). Used both for the
 * live page (media resolved from the gateway) and the create-flow preview
 * (media resolved from local object URLs).
 */

export interface MemorialViewData {
  name: string;
  status?: SubjectStatus;
  altName?: string;
  born?: string;
  died?: string;
  epitaph?: string;
  bio?: string;
  portrait?: MediaRef;
  voice?: MediaRef;
  media: MediaRef[];
  events?: LifeEvent[];
}

/** txId → displayable URL (gateway URL or local object URL in previews). */
export type MediaUrlMap = Record<string, string>;

function MediaImage({
  src,
  alt,
  sizes,
  className,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      unoptimized={src.startsWith("blob:")}
      className={`object-cover ${className ?? ""}`}
    />
  );
}

export default function MemorialView({
  data,
  mediaUrls,
}: {
  data: MemorialViewData;
  mediaUrls: MediaUrlMap;
}) {
  const { t } = useI18n();
  const living = data.status === "living";
  const resolveUrl = (ref: MediaRef) => mediaUrls[ref.txId] ?? "";
  const dates = lifeDates(data, t.memorial.present);
  const paragraphs = (data.bio ?? "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <article className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      {/* Stone header */}
      <header className="halo flex flex-col items-center pt-14 pb-10 text-center">
        {data.portrait && (
          <div
            className={`relative mb-8 h-40 w-40 overflow-hidden rounded-full ring-1 ring-offset-4 ring-offset-background sm:h-48 sm:w-48 ${
              living ? "ring-life/60" : "ring-accent/60"
            }`}
          >
            <MediaImage
              src={resolveUrl(data.portrait)}
              alt={data.name}
              sizes="12rem"
            />
          </div>
        )}
        {living ? (
          <p className="mb-4 flex items-center gap-2.5 text-[11px] uppercase tracking-[0.35em] text-life">
            <span className="life-dot" aria-hidden />
            {t.memorial.livingBadge}
          </p>
        ) : (
          <p className="mb-4 text-[11px] uppercase tracking-[0.35em] text-accent">
            {t.memorial.inLivingMemory}
          </p>
        )}
        <h1 className="font-serif text-4xl font-semibold leading-tight sm:text-5xl">
          {data.name}
        </h1>
        {data.altName && (
          <p className="mt-2 font-serif text-lg text-muted">{data.altName}</p>
        )}
        {dates && (
          <p className="mt-4 text-sm tracking-[0.2em] text-muted">{dates}</p>
        )}
        {data.epitaph && (
          <p className="mt-8 max-w-xl font-serif text-xl italic leading-relaxed text-foreground/90">
            「{data.epitaph}」
          </p>
        )}
        <div
          className={`mt-10 h-px w-24 ${living ? "bg-life/50" : "bg-accent/50"}`}
          aria-hidden
        />
      </header>

      {/* Voice legacy */}
      {data.voice && resolveUrl(data.voice) && (
        <section className="flex flex-col items-center py-8">
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-accent">
            {t.memorial.voice}
          </p>
          <audio
            controls
            preload="metadata"
            src={resolveUrl(data.voice)}
            className="w-full max-w-md"
          />
          {data.voice.caption && (
            <p className="mt-2 text-xs text-muted">{data.voice.caption}</p>
          )}
        </section>
      )}

      {/* Life story */}
      {paragraphs.length > 0 && (
        <section className="py-10">
          <h2 className="mb-6 text-center font-serif text-2xl font-semibold">
            {living ? t.memorial.storyLiving : t.memorial.story}
          </h2>
          <div className="space-y-5 text-[15px] leading-8 text-foreground/85">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      )}

      {/* Timeline — a scroll through the years */}
      {(data.events?.length ?? 0) > 0 && (
        <section className="py-10">
          <h2 className="mb-8 text-center font-serif text-2xl font-semibold">
            {t.memorial.timeline}
          </h2>
          <ol className="relative mx-auto max-w-xl border-l border-accent/40 pl-8">
            {data.events!.map((ev, i) => (
              <li key={i} className="relative pb-8 last:pb-0">
                <span
                  className="absolute -left-[37px] top-1.5 h-2.5 w-2.5 rounded-full border border-accent bg-background"
                  aria-hidden
                />
                <p className="font-serif text-sm tracking-[0.15em] text-accent">
                  {ev.year}
                </p>
                <h3 className="mt-1 font-serif text-lg font-semibold">
                  {ev.title}
                </h3>
                {ev.detail && (
                  <p className="mt-1.5 text-sm leading-7 text-muted">
                    {ev.detail}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Gallery */}
      {data.media.length > 0 && (
        <section className="py-10">
          <h2 className="mb-6 text-center font-serif text-2xl font-semibold">
            {t.memorial.gallery}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {data.media.map((ref, i) =>
              ref.kind === "video" ? (
                <figure key={ref.txId + i} className="col-span-2 sm:col-span-3">
                  <video
                    src={resolveUrl(ref)}
                    controls
                    preload="metadata"
                    className="w-full rounded-lg border border-border"
                  />
                  {ref.caption && (
                    <figcaption className="mt-2 text-center text-xs text-muted">
                      {ref.caption}
                    </figcaption>
                  )}
                </figure>
              ) : (
                <figure key={ref.txId + i}>
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-border">
                    <MediaImage
                      src={resolveUrl(ref)}
                      alt={ref.caption ?? data.name}
                      sizes="(max-width: 640px) 50vw, 240px"
                    />
                  </div>
                  {ref.caption && (
                    <figcaption className="mt-2 text-center text-xs text-muted">
                      {ref.caption}
                    </figcaption>
                  )}
                </figure>
              ),
            )}
          </div>
        </section>
      )}
    </article>
  );
}
