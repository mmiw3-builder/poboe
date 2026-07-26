import type { Metadata } from "next";
import Link from "next/link";
import MemorialActions from "@/components/memorial/MemorialActions";
import MemorialView from "@/components/memorial/MemorialView";
import Tributes from "@/components/memorial/Tributes";
import { getDictionary, getLocale } from "@/i18n/server";
import { gatewayUrlFor } from "@/lib/irys/config";
import { getMemorial, listTributes } from "@/lib/memorial/repo";
import type { MemorialManifest } from "@/lib/memorial/schema";

export const runtime = "nodejs";

function mediaUrlMap(manifest: MemorialManifest): Record<string, string> {
  const map: Record<string, string> = {};
  if (manifest.subject.portrait) {
    map[manifest.subject.portrait.txId] = gatewayUrlFor(
      manifest.subject.portrait.txId,
    );
  }
  if (manifest.subject.voice) {
    map[manifest.subject.voice.txId] = gatewayUrlFor(
      manifest.subject.voice.txId,
    );
  }
  for (const ref of manifest.media) {
    map[ref.txId] = gatewayUrlFor(ref.txId);
  }
  return map;
}

export async function generateMetadata(
  props: PageProps<"/m/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const result = await getMemorial(id);
  if (!result) {
    const t = getDictionary(await getLocale());
    return { title: t.memorial.notFound };
  }
  const { manifest } = result;
  const description =
    manifest.subject.epitaph ??
    manifest.subject.bio?.slice(0, 120) ??
    undefined;
  return {
    title: manifest.subject.name,
    description,
    openGraph: {
      title: manifest.subject.name,
      description,
      images: manifest.subject.portrait
        ? [gatewayUrlFor(manifest.subject.portrait.txId)]
        : undefined,
    },
  };
}

export default async function MemorialPage(props: PageProps<"/m/[id]">) {
  const { id } = await props.params;
  const locale = await getLocale();
  const t = getDictionary(locale);

  const result = await getMemorial(id);
  if (!result) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="font-serif text-3xl font-semibold">
          {t.memorial.notFound}
        </h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-muted">
          {t.memorial.notFoundBody}
        </p>
        <Link href="/" className="btn-outline mt-8">
          {t.nav.home}
        </Link>
      </main>
    );
  }

  const { manifest, txId } = result;
  const tributes = await listTributes(id, { limit: 100 });

  return (
    <main className="flex-1 pb-10">
      <MemorialView
        data={{
          ...manifest.subject,
          media: manifest.media,
          events: manifest.events,
        }}
        mediaUrls={mediaUrlMap(manifest)}
      />

      <Tributes
        memorialId={id}
        enabled={manifest.tributesEnabled}
        initialCounts={tributes.counts}
        initialMessages={tributes.items
          .filter((item) => item.tribute.kind === "message" && item.tribute.message)
          .map((item) => ({
            name: item.tribute.name,
            message: item.tribute.message ?? "",
            createdAt: item.tribute.createdAt,
          }))}
      />

      <MemorialActions
        memorialId={id}
        verifyUrl={gatewayUrlFor(txId)}
        card={{
          name: manifest.subject.name,
          altName: manifest.subject.altName,
          dates: [manifest.subject.born, manifest.subject.died]
            .filter(Boolean)
            .join(" — "),
          epitaph: manifest.subject.epitaph,
          portraitUrl: manifest.subject.portrait
            ? gatewayUrlFor(manifest.subject.portrait.txId)
            : undefined,
        }}
      />
    </main>
  );
}
