import Image from "next/image";
import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/server";
import { gatewayUrlFor } from "@/lib/irys/config";
import { lifeDates } from "@/lib/memorial/display";
import type { MemorialManifest } from "@/lib/memorial/schema";

/** Compact gallery card — pure server component. */
export default async function MemorialCard({
  manifest,
}: {
  manifest: MemorialManifest;
}) {
  const t = getDictionary(await getLocale());
  const { subject } = manifest;
  const living = subject.status === "living";
  const dates = lifeDates(subject, t.memorial.present);

  return (
    <Link
      href={`/m/${manifest.id}`}
      className="group flex flex-col items-center rounded-2xl border border-border bg-surface px-6 py-8 text-center transition-colors hover:border-accent/60"
    >
      {subject.portrait ? (
        <span className="relative mb-4 block h-20 w-20 overflow-hidden rounded-full ring-1 ring-border transition group-hover:ring-accent/60">
          <Image
            src={gatewayUrlFor(subject.portrait.txId)}
            alt={subject.name}
            fill
            sizes="5rem"
            className="object-cover"
          />
        </span>
      ) : (
        <span className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-halo font-serif text-2xl text-accent ring-1 ring-border">
          {subject.name.slice(0, 1)}
        </span>
      )}
      <h3 className="flex items-center gap-2 font-serif text-lg font-semibold leading-snug">
        {living && <span className="life-dot" aria-hidden />}
        {subject.name}
      </h3>
      {dates && (
        <p className="mt-1 text-xs tracking-[0.15em] text-muted">{dates}</p>
      )}
      {subject.epitaph && (
        <p className="mt-3 line-clamp-2 font-serif text-sm italic leading-6 text-foreground/75">
          「{subject.epitaph}」
        </p>
      )}
    </Link>
  );
}
