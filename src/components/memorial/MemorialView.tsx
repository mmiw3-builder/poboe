"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/client";
import type { MediaRef } from "@/lib/memorial/schema";

/**
 * Shared presentational memorial ("digital gravestone"). Used both for the
 * live page (media resolved from the gateway) and the create-flow preview
 * (media resolved from local object URLs).
 */

export interface MemorialViewData {
  name: string;
  altName?: string;
  born?: string;
  died?: string;
  epitaph?: string;
  bio?: string;
  portrait?: MediaRef;
  media: MediaRef[];
}

export type MediaUrlResolver = (ref: MediaRef) => string;

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
  resolveUrl,
}: {
  data: MemorialViewData;
  resolveUrl: MediaUrlResolver;
}) {
  const { t } = useI18n();
  const dates = [data.born, data.died].filter(Boolean).join(" — ");
  const paragraphs = (data.bio ?? "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <article className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      {/* Stone header */}
      <header className="halo flex flex-col items-center pt-14 pb-10 text-center">
        {data.portrait && (
          <div className="relative mb-8 h-40 w-40 overflow-hidden rounded-full ring-1 ring-accent/60 ring-offset-4 ring-offset-background sm:h-48 sm:w-48">
            <MediaImage
              src={resolveUrl(data.portrait)}
              alt={data.name}
              sizes="12rem"
            />
          </div>
        )}
        <p className="mb-4 text-[11px] uppercase tracking-[0.35em] text-accent">
          {t.memorial.inLivingMemory}
        </p>
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
        <div className="mt-10 h-px w-24 bg-accent/50" aria-hidden />
      </header>

      {/* Life story */}
      {paragraphs.length > 0 && (
        <section className="py-10">
          <h2 className="mb-6 text-center font-serif text-2xl font-semibold">
            {t.memorial.story}
          </h2>
          <div className="space-y-5 text-[15px] leading-8 text-foreground/85">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
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
