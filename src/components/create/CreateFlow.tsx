"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import BioInterview from "@/components/create/BioInterview";
import MemorialView from "@/components/memorial/MemorialView";
import { useI18n } from "@/i18n/client";
import { uploadMedia, type UploadedMedia } from "@/lib/client/media";
import { keyBackupBlob, type StoredKey } from "@/lib/client/keystore";
import {
  PublishError,
  publishNewMemorial,
  publishUpdate,
} from "@/lib/client/publish";
import type {
  LifeEvent,
  MediaRef,
  MemorialManifest,
} from "@/lib/memorial/schema";
import { LIMITS } from "@/lib/moderation/limits";

/** Editing context: reuse the wizard on an existing memorial. */
export interface EditContext {
  storedKey: StoredKey;
  manifest: MemorialManifest;
  /** txId → gateway URL for already-stored media. */
  mediaUrls: Record<string, string>;
}

type PendingMedia =
  | { status: "uploading"; localId: string; previewUrl: string }
  | { status: "done"; localId: string; media: UploadedMedia; caption: string };

function toMediaRef(m: UploadedMedia, caption?: string): MediaRef {
  return {
    txId: m.txId,
    kind: m.kind,
    contentType: m.contentType,
    caption: caption?.trim() ? caption.trim() : undefined,
    size: m.size,
    width: m.width,
    height: m.height,
  };
}

function toPending(
  refs: MediaRef[],
  mediaUrls: Record<string, string>,
): PendingMedia[] {
  return refs.map((ref) => ({
    status: "done",
    localId: crypto.randomUUID(),
    media: { ...ref, previewUrl: mediaUrls[ref.txId] ?? "" },
    caption: ref.caption ?? "",
  }));
}

export default function CreateFlow({ edit }: { edit?: EditContext }) {
  const { t, locale } = useI18n();
  const [step, setStep] = useState(0);
  const initial = edit?.manifest;

  // Step 1 — basics
  const [name, setName] = useState(initial?.subject.name ?? "");
  const [altName, setAltName] = useState(initial?.subject.altName ?? "");
  const [born, setBorn] = useState(initial?.subject.born ?? "");
  const [died, setDied] = useState(initial?.subject.died ?? "");
  const [epitaph, setEpitaph] = useState(initial?.subject.epitaph ?? "");

  // Step 2 — story & media
  const [bio, setBio] = useState(initial?.subject.bio ?? "");
  const [portrait, setPortrait] = useState<PendingMedia | null>(() =>
    initial?.subject.portrait && edit
      ? toPending([initial.subject.portrait], edit.mediaUrls)[0]
      : null,
  );
  const [voice, setVoice] = useState<PendingMedia | null>(() =>
    initial?.subject.voice && edit
      ? toPending([initial.subject.voice], edit.mediaUrls)[0]
      : null,
  );
  const [gallery, setGallery] = useState<PendingMedia[]>(() =>
    initial && edit ? toPending(initial.media, edit.mediaUrls) : [],
  );
  const [events, setEvents] = useState<LifeEvent[]>(initial?.events ?? []);
  const [tributesEnabled, setTributesEnabled] = useState(
    initial?.tributesEnabled ?? true,
  );

  // Step 3 — publish
  const [agree, setAgree] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    memorialId: string;
    key: StoredKey | null;
  } | null>(null);

  const portraitInput = useRef<HTMLInputElement>(null);
  const voiceInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const uploadBusy =
    portrait?.status === "uploading" ||
    voice?.status === "uploading" ||
    gallery.some((g) => g.status === "uploading");

  const cleanEvents = useMemo(
    () =>
      events
        .map((ev) => ({
          year: ev.year.trim(),
          title: ev.title.trim(),
          detail: ev.detail?.trim() || undefined,
        }))
        .filter((ev) => ev.year && ev.title),
    [events],
  );

  const previewData = useMemo(() => {
    const doneGallery = gallery.filter(
      (g): g is Extract<PendingMedia, { status: "done" }> =>
        g.status === "done",
    );
    return {
      name: name.trim(),
      altName: altName.trim() || undefined,
      born: born.trim() || undefined,
      died: died.trim() || undefined,
      epitaph: epitaph.trim() || undefined,
      bio: bio.trim() || undefined,
      portrait:
        portrait?.status === "done"
          ? toMediaRef(portrait.media)
          : undefined,
      voice: voice?.status === "done" ? toMediaRef(voice.media) : undefined,
      media: doneGallery.map((g) => toMediaRef(g.media, g.caption)),
      events: cleanEvents,
    };
  }, [name, altName, born, died, epitaph, bio, portrait, voice, gallery, cleanEvents]);

  const previewUrls = useMemo(() => {
    const map: Record<string, string> = {};
    if (portrait?.status === "done") {
      map[portrait.media.txId] = portrait.media.previewUrl;
    }
    if (voice?.status === "done") {
      map[voice.media.txId] = voice.media.previewUrl;
    }
    for (const g of gallery) {
      if (g.status === "done") map[g.media.txId] = g.media.previewUrl;
    }
    return map;
  }, [portrait, voice, gallery]);

  async function handlePortrait(file: File) {
    const localId = crypto.randomUUID();
    setError(null);
    setPortrait({
      status: "uploading",
      localId,
      previewUrl: URL.createObjectURL(file),
    });
    try {
      const media = await uploadMedia(file);
      setPortrait({ status: "done", localId, media, caption: "" });
    } catch {
      setPortrait(null);
      setError(t.create.upload.failed);
    }
  }

  async function handleVoice(file: File) {
    const localId = crypto.randomUUID();
    setError(null);
    setVoice({
      status: "uploading",
      localId,
      previewUrl: URL.createObjectURL(file),
    });
    try {
      const media = await uploadMedia(file);
      setVoice({ status: "done", localId, media, caption: "" });
    } catch {
      setVoice(null);
      setError(t.create.upload.failed);
    }
  }

  async function handleGalleryFiles(files: FileList) {
    setError(null);
    for (const file of Array.from(files)) {
      if (gallery.length >= LIMITS.maxMediaCount) {
        setError(t.create.upload.tooMany);
        return;
      }
      const localId = crypto.randomUUID();
      setGallery((g) => [
        ...g,
        { status: "uploading", localId, previewUrl: URL.createObjectURL(file) },
      ]);
      try {
        const media = await uploadMedia(file);
        setGallery((g) =>
          g.map((item) =>
            item.localId === localId
              ? { status: "done", localId, media, caption: "" }
              : item,
          ),
        );
      } catch {
        setGallery((g) => g.filter((item) => item.localId !== localId));
        setError(t.create.upload.failed);
      }
    }
  }

  async function handlePublish() {
    if (!name.trim()) {
      setError(t.create.errors.nameRequired);
      setStep(0);
      return;
    }
    if (!agree) {
      setError(t.create.errors.agreeRequired);
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const draft = {
        ...previewData,
        media: previewData.media,
        tributesEnabled,
        lang: initial?.lang ?? locale,
        // Keep previously-approved contributions across ordinary edits.
        approvedContributions: edit?.manifest.approvedContributions,
      };
      if (edit) {
        await publishUpdate(edit.storedKey, edit.manifest, draft);
        setResult({ memorialId: edit.storedKey.memorialId, key: null });
      } else {
        const res = await publishNewMemorial(draft);
        setResult({ memorialId: res.memorialId, key: res.key });
      }
    } catch (err) {
      if (err instanceof PublishError) {
        if (err.code === "content_rejected") setError(t.create.errors.rejected);
        else if (err.code === "rate_limited")
          setError(t.create.errors.rateLimited);
        else setError(t.create.errors.failed);
      } else {
        setError(t.create.errors.failed);
      }
    } finally {
      setPublishing(false);
    }
  }

  if (result) {
    return <SuccessPanel memorialId={result.memorialId} keyData={result.key} />;
  }

  const steps = [
    t.create.steps.basics,
    t.create.steps.story,
    t.create.steps.publish,
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-20 sm:px-6">
      <h1 className="mt-12 text-center font-serif text-3xl font-semibold sm:text-4xl">
        {edit ? t.space.editTitle : t.create.title}
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-muted">
        {t.create.intro}
      </p>
      <p className="mx-auto mt-4 max-w-xl rounded-lg border border-accent/40 bg-halo px-4 py-3 text-center text-xs leading-5 text-accent-strong">
        {t.create.permanenceWarning}
      </p>

      {/* Step indicator */}
      <ol className="mx-auto mt-10 flex max-w-md items-center justify-between">
        {steps.map((label, i) => (
          <li key={label} className="flex flex-1 items-center">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-2 text-xs ${
                i === step
                  ? "text-accent"
                  : i < step
                    ? "text-foreground/70"
                    : "text-muted"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                  i <= step ? "border-accent text-accent" : "border-border"
                }`}
              >
                {i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < steps.length - 1 && (
              <span className="mx-2 h-px flex-1 bg-border" aria-hidden />
            )}
          </li>
        ))}
      </ol>

      {error && (
        <p className="mt-6 rounded-lg border border-red-400/40 bg-red-500/5 px-4 py-3 text-center text-sm text-red-500">
          {error}
        </p>
      )}

      {/* Step content */}
      {step === 0 && (
        <div className="mt-8 space-y-5">
          <Field label={t.create.fields.name} required>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.create.fields.namePlaceholder}
              maxLength={120}
            />
          </Field>
          <Field label={t.create.fields.altName}>
            <input
              className="input"
              value={altName}
              onChange={(e) => setAltName(e.target.value)}
              placeholder={t.create.fields.altNamePlaceholder}
              maxLength={120}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.create.fields.born}>
              <input
                className="input"
                value={born}
                onChange={(e) => setBorn(e.target.value)}
                placeholder={t.create.fields.bornPlaceholder}
                maxLength={40}
              />
            </Field>
            <Field label={t.create.fields.died}>
              <input
                className="input"
                value={died}
                onChange={(e) => setDied(e.target.value)}
                placeholder={t.create.fields.diedPlaceholder}
                maxLength={40}
              />
            </Field>
          </div>
          <Field label={t.create.fields.epitaph}>
            <input
              className="input"
              value={epitaph}
              onChange={(e) => setEpitaph(e.target.value)}
              placeholder={t.create.fields.epitaphPlaceholder}
              maxLength={200}
            />
          </Field>

          <Field label={t.create.fields.portrait}>
            <input
              ref={portraitInput}
              type="file"
              accept={LIMITS.allowedImageTypes.join(",")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePortrait(f);
                e.target.value = "";
              }}
            />
            <div className="flex items-center gap-4">
              {portrait ? (
                <span className="relative block h-20 w-20 overflow-hidden rounded-full ring-1 ring-accent/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      portrait.status === "done"
                        ? portrait.media.previewUrl
                        : portrait.previewUrl
                    }
                    alt=""
                    className={`h-full w-full object-cover ${
                      portrait.status === "uploading" ? "opacity-50" : ""
                    }`}
                  />
                </span>
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-border text-muted">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
                    <circle cx="12" cy="9" r="3.2" />
                    <path d="M5.5 19a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
                  </svg>
                </span>
              )}
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => portraitInput.current?.click()}
                  disabled={portrait?.status === "uploading"}
                >
                  {portrait?.status === "uploading"
                    ? t.create.upload.uploading
                    : t.create.upload.addPortrait}
                </button>
                {portrait && portrait.status === "done" && (
                  <button
                    type="button"
                    className="text-left text-xs text-muted hover:text-red-500"
                    onClick={() => setPortrait(null)}
                  >
                    {t.create.upload.remove}
                  </button>
                )}
              </div>
            </div>
          </Field>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              className="btn-primary"
              disabled={!name.trim() || uploadBusy}
              onClick={() => setStep(1)}
            >
              {t.common.next}
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="mt-8 space-y-5">
          <Field label={t.create.fields.bio}>
            <textarea
              className="input min-h-56"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t.create.fields.bioPlaceholder}
              maxLength={20000}
            />
            <BioInterview
              name={name}
              hasExistingBio={Boolean(bio.trim())}
              onDraft={(draft) => setBio(draft)}
            />
          </Field>

          <Field label={t.create.fields.timeline}>
            <p className="mb-3 text-xs text-muted">
              {t.create.fields.timelineHint}
            </p>
            <div className="space-y-3">
              {events.map((ev, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-surface p-3"
                >
                  <div className="flex gap-2">
                    <input
                      className="input !w-32"
                      value={ev.year}
                      maxLength={20}
                      placeholder={t.create.fields.timelineYearPlaceholder}
                      onChange={(e) =>
                        setEvents((list) =>
                          list.map((x, j) =>
                            j === i ? { ...x, year: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <input
                      className="input flex-1"
                      value={ev.title}
                      maxLength={120}
                      placeholder={t.create.fields.timelineTitlePlaceholder}
                      onChange={(e) =>
                        setEvents((list) =>
                          list.map((x, j) =>
                            j === i ? { ...x, title: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      aria-label={t.create.upload.remove}
                      className="px-2 text-muted hover:text-red-500"
                      onClick={() =>
                        setEvents((list) => list.filter((_, j) => j !== i))
                      }
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    className="input mt-2"
                    value={ev.detail ?? ""}
                    maxLength={1000}
                    placeholder={t.create.fields.timelineDetail}
                    onChange={(e) =>
                      setEvents((list) =>
                        list.map((x, j) =>
                          j === i ? { ...x, detail: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                className="btn-outline !h-9 !px-4 text-xs"
                disabled={events.length >= 50}
                onClick={() =>
                  setEvents((list) => [...list, { year: "", title: "" }])
                }
              >
                + {t.create.fields.addEvent}
              </button>
            </div>
          </Field>

          <Field label={t.create.fields.voice}>
            <p className="mb-3 text-xs text-muted">{t.create.fields.voiceHint}</p>
            <input
              ref={voiceInput}
              type="file"
              accept={LIMITS.allowedAudioTypes.join(",")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleVoice(f);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-outline"
                onClick={() => voiceInput.current?.click()}
                disabled={voice?.status === "uploading"}
              >
                {voice?.status === "uploading"
                  ? t.create.upload.uploading
                  : t.create.upload.addVoice}
              </button>
              {voice?.status === "done" && (
                <>
                  <audio
                    controls
                    src={voice.media.previewUrl}
                    className="h-10 max-w-60"
                  />
                  <button
                    type="button"
                    className="text-xs text-muted hover:text-red-500"
                    onClick={() => setVoice(null)}
                  >
                    {t.create.upload.remove}
                  </button>
                </>
              )}
            </div>
          </Field>

          <Field
            label={`${t.create.fields.gallery} (${gallery.length}/${LIMITS.maxMediaCount})`}
          >
            <input
              ref={galleryInput}
              type="file"
              multiple
              accept={[
                ...LIMITS.allowedImageTypes,
                ...LIMITS.allowedVideoTypes,
              ].join(",")}
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void handleGalleryFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {gallery.map((item) => (
                <div key={item.localId} className="space-y-1">
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-border">
                    {item.status === "done" && item.media.kind === "video" ? (
                      <video
                        src={item.media.previewUrl}
                        className="h-full w-full object-cover"
                        muted
                      />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={
                          item.status === "done"
                            ? item.media.previewUrl
                            : item.previewUrl
                        }
                        alt=""
                        className={`h-full w-full object-cover ${
                          item.status === "uploading" ? "opacity-50" : ""
                        }`}
                      />
                    )}
                    <button
                      type="button"
                      aria-label={t.create.upload.remove}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-xs hover:text-red-500"
                      onClick={() =>
                        setGallery((g) =>
                          g.filter((x) => x.localId !== item.localId),
                        )
                      }
                    >
                      ✕
                    </button>
                  </div>
                  {item.status === "done" ? (
                    <input
                      className="w-full rounded border border-border bg-transparent px-1.5 py-1 text-xs"
                      placeholder={t.create.fields.caption}
                      value={item.caption}
                      maxLength={300}
                      onChange={(e) =>
                        setGallery((g) =>
                          g.map((x) =>
                            x.localId === item.localId
                              ? { ...x, caption: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  ) : (
                    <p className="text-center text-[10px] text-muted">
                      {t.create.upload.uploading}
                    </p>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border text-3xl text-muted transition-colors hover:border-accent hover:text-accent"
                onClick={() => galleryInput.current?.click()}
                disabled={gallery.length >= LIMITS.maxMediaCount}
              >
                +
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">
              {t.create.upload.imageHint} · {t.create.upload.videoHint}
            </p>
          </Field>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={tributesEnabled}
              onChange={(e) => setTributesEnabled(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {t.create.fields.tributesEnabled}
          </label>

          <div className="flex justify-between pt-2">
            <button type="button" className="btn-outline" onClick={() => setStep(0)}>
              {t.common.previous}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={uploadBusy}
              onClick={() => setStep(2)}
            >
              {t.common.next}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-8">
          {previewData.name ? (
            <div className="rounded-2xl border border-border bg-surface">
              <MemorialView data={previewData} mediaUrls={previewUrls} />
            </div>
          ) : (
            <p className="text-center text-sm text-muted">
              {t.create.preview.empty}
            </p>
          )}

          <label className="mt-8 flex items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[var(--accent)]"
            />
            <span>{t.create.agree}</span>
          </label>

          <div className="mt-8 flex justify-between">
            <button type="button" className="btn-outline" onClick={() => setStep(1)}>
              {t.common.previous}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={publishing || uploadBusy || !agree || !name.trim()}
              onClick={() => void handlePublish()}
            >
              {publishing ? t.create.publishing : t.create.publish}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-accent">*</span>}
      </span>
      {children}
    </label>
  );
}

function SuccessPanel({
  memorialId,
  keyData,
}: {
  memorialId: string;
  /** null when this was an update — the key already exists. */
  keyData: StoredKey | null;
}) {
  const { t } = useI18n();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/m/${memorialId}`
      : `/m/${memorialId}`;

  function downloadKey() {
    if (!keyData) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(keyBackupBlob(keyData));
    a.download = `evermark-key-${memorialId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!keyData) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 pb-20 text-center sm:px-6">
        <div className="halo pt-16">
          <p className="text-4xl">🕊️</p>
          <h1 className="mt-6 font-serif text-3xl font-semibold">
            {t.space.updatedTitle}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted">
            {t.space.updatedBody}
          </p>
        </div>
        <div className="mt-10">
          <Link href={`/m/${memorialId}`} className="btn-primary inline-flex">
            {t.create.success.visit}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-20 text-center sm:px-6">
      <div className="halo pt-16">
        <p className="text-4xl">🕊️</p>
        <h1 className="mt-6 font-serif text-3xl font-semibold">
          {t.create.success.title}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted">
          {t.create.success.body}
        </p>
      </div>

      <div className="mt-10 rounded-2xl border border-accent/40 bg-surface p-6 text-left">
        <h2 className="font-serif text-lg font-semibold text-accent-strong">
          {t.create.success.keyTitle}
        </h2>
        <p className="mt-2 text-xs leading-5 text-muted">
          {t.create.success.keyBody}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={downloadKey}>
            {t.create.success.downloadKey}
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              void navigator.clipboard.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? t.common.copied : t.create.success.copyLink}
          </button>
        </div>
        <label className="mt-5 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          {t.create.success.confirmSaved}
        </label>
      </div>

      <div className="mt-8">
        {saved ? (
          <Link href={`/m/${memorialId}`} className="btn-primary inline-flex">
            {t.create.success.visit}
          </Link>
        ) : (
          <span className="btn-primary inline-flex cursor-not-allowed opacity-40">
            {t.create.success.visit}
          </span>
        )}
      </div>
    </div>
  );
}
