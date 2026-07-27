"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BillingPanel from "@/components/create/BillingPanel";
import { useI18n } from "@/i18n/client";
import { EntryPublishError, publishEntry } from "@/lib/client/journal";
import type { StoredKey } from "@/lib/client/keystore";
import { ensureKey } from "@/lib/client/keysync";
import { uploadMedia, type UploadedMedia } from "@/lib/client/media";
import type { JournalEntry, MediaRef } from "@/lib/memorial/schema";
import { LIMITS } from "@/lib/moderation/limits";

/**
 * 时光 — the journal stream. Everyone reads the moments; the keyholder
 * gets a lightweight composer to add one without touching the manifest.
 */

export interface JournalItem {
  entry: JournalEntry;
  txId: string;
}

function toMediaRef(m: UploadedMedia): MediaRef {
  return {
    txId: m.txId,
    kind: m.kind,
    contentType: m.contentType,
    size: m.size,
    width: m.width,
    height: m.height,
  };
}

function EntryCard({
  entry,
  urls,
  locale,
}: {
  entry: JournalEntry;
  urls: Record<string, string>;
  locale: string;
}) {
  const date = new Date(entry.createdAt).toLocaleDateString(
    locale === "zh" ? "zh-CN" : "en-US",
    { year: "numeric", month: "long", day: "numeric" },
  );
  const paragraphs = (entry.text ?? "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const media = entry.media ?? [];

  return (
    <li className="relative pb-10 pl-8 last:pb-0">
      <span
        className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border border-accent bg-background"
        aria-hidden
      />
      <p className="font-serif text-sm tracking-[0.15em] text-accent">{date}</p>
      {paragraphs.length > 0 && (
        <div className="mt-2 space-y-3 text-[15px] leading-7 text-foreground/85">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
      {media.length > 0 && (
        <div
          className={`mt-3 grid gap-2 ${
            media.length === 1 ? "grid-cols-1 max-w-sm" : "grid-cols-3"
          }`}
        >
          {media.map((ref, i) => {
            const src = urls[ref.txId];
            if (!src) return null;
            return (
              <span
                key={ref.txId + i}
                className={`relative block overflow-hidden rounded-lg border border-border ${
                  media.length === 1 ? "aspect-[4/3]" : "aspect-square"
                }`}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 33vw, 200px"
                  unoptimized={src.startsWith("blob:")}
                  className="object-cover"
                />
              </span>
            );
          })}
        </div>
      )}
    </li>
  );
}

function Composer({
  storedKey,
  onPublished,
}: {
  storedKey: StoredKey;
  onPublished: (item: JournalItem, previewUrls: Record<string, string>) => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<UploadedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sufficient, setSufficient] = useState(true);
  const onSufficiency = useCallback((ok: boolean) => setSufficient(ok), []);
  const fileInput = useRef<HTMLInputElement>(null);

  const mediaCost = photos.reduce((s, p) => s + (p.costMicroUsd ?? 0), 0);
  const hasContent = Boolean(text.trim()) || photos.length > 0;
  const bytesEstimate = useMemo(
    () => new Blob([text]).size + photos.length * 250 + 400,
    [text, photos.length],
  );

  async function addPhotos(files: FileList) {
    setMessage(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (photos.length >= LIMITS.entryMediaCount) break;
        const media = await uploadMedia(file);
        setPhotos((p) =>
          p.length < LIMITS.entryMediaCount ? [...p, media] : p,
        );
      }
    } catch (err) {
      setMessage(
        err instanceof Error && err.message === "insufficient_balance"
          ? t.billing.insufficient
          : t.journal.photoFailed,
      );
    } finally {
      setUploading(false);
    }
  }

  async function publish() {
    if (!hasContent) {
      setMessage(t.journal.needContent);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { txId, entry } = await publishEntry(storedKey, {
        text,
        media: photos.map(toMediaRef),
      });
      const previews: Record<string, string> = {};
      for (const p of photos) previews[p.txId] = p.previewUrl;
      onPublished({ entry, txId }, previews);
      setText("");
      setPhotos([]);
      setMessage(t.journal.published);
    } catch (err) {
      if (err instanceof EntryPublishError) {
        if (err.code === "insufficient_balance")
          setMessage(t.billing.insufficient);
        else if (err.code === "content_rejected")
          setMessage(t.journal.rejected);
        else if (err.code === "unauthorized")
          setMessage(t.journal.signInRequired);
        else setMessage(t.journal.failed);
      } else {
        setMessage(t.journal.failed);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-10 rounded-2xl border border-border bg-surface p-5">
      <textarea
        className="input min-h-24 !border-0 !bg-transparent !px-0 !py-0"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.journal.composerPlaceholder}
        maxLength={5000}
      />
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((p) => (
            <span
              key={p.txId}
              className="relative block aspect-square overflow-hidden rounded-lg border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                aria-label={t.create.upload.remove}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-[10px] hover:text-red-500"
                onClick={() =>
                  setPhotos((list) => list.filter((x) => x.txId !== p.txId))
                }
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {hasContent && (
        <BillingPanel
          bytesEstimate={bytesEstimate}
          mediaCostMicroUsd={mediaCost}
          onSufficiency={onSufficiency}
        />
      )}

      {message && (
        <p className="mt-3 text-xs text-accent">
          {message}{" "}
          {message === t.journal.signInRequired && (
            <Link href="/space" className="underline underline-offset-4">
              {t.nav.mySpace}
            </Link>
          )}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={LIMITS.allowedImageTypes.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void addPhotos(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="btn-outline !h-9 !px-4 text-xs"
          disabled={uploading || photos.length >= LIMITS.entryMediaCount}
          onClick={() => fileInput.current?.click()}
        >
          {uploading
            ? t.create.upload.uploading
            : `+ ${t.journal.addPhotos} (${photos.length}/${LIMITS.entryMediaCount})`}
        </button>
        <button
          type="button"
          className="btn-primary !h-9 !px-5 text-xs"
          disabled={busy || uploading || !hasContent || !sufficient}
          onClick={() => void publish()}
        >
          {busy ? t.journal.publishing : t.journal.publish}
        </button>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-muted/80">
        {t.journal.ownerHint}
      </p>
    </div>
  );
}

export default function Journal({
  memorialId,
  initialItems,
  mediaUrls,
}: {
  memorialId: string;
  initialItems: JournalItem[];
  mediaUrls: Record<string, string>;
}) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<JournalItem[]>(initialItems);
  const [urls, setUrls] = useState<Record<string, string>>(mediaUrls);
  const [storedKey, setStoredKey] = useState<StoredKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Deferred: local keystore first, then account custody (cross-device).
    queueMicrotask(() => {
      void ensureKey(memorialId).then((key) => {
        if (!cancelled) setStoredKey(key);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [memorialId]);

  if (items.length === 0 && !storedKey) return null;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h2 className="mb-8 text-center font-serif text-2xl font-semibold">
        {t.journal.title}
      </h2>

      {storedKey && (
        <Composer
          storedKey={storedKey}
          onPublished={(item, previews) => {
            setItems((list) => [item, ...list]);
            setUrls((map) => ({ ...map, ...previews }));
          }}
        />
      )}

      {items.length === 0 ? (
        <p className="text-center text-sm text-muted">{t.journal.empty}</p>
      ) : (
        <ol className="relative mx-auto max-w-xl border-l border-accent/40">
          {items.map((item) => (
            <EntryCard
              key={item.txId}
              entry={item.entry}
              urls={urls}
              locale={locale}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
