"use client";

import { LIMITS } from "@/lib/moderation/limits";
import type { MediaRef } from "@/lib/memorial/schema";

/** Compress an image in the browser: bounded dimensions, WebP output. */
export async function compressImage(
  file: File,
  opts: { maxDimension?: number; quality?: number } = {},
): Promise<Blob> {
  const maxDimension = opts.maxDimension ?? 2000;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    maxDimension / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", opts.quality ?? 0.85),
  );
  if (!blob) throw new Error("image compression failed");
  return blob;
}

export interface UploadedMedia extends MediaRef {
  /** Local object URL for immediate preview. */
  previewUrl: string;
  /** What this upload deducted from the balance (0 when free allowance covered it). */
  costMicroUsd?: number;
}

/**
 * Prepare and upload one media file through the server-paid endpoint.
 * Images are compressed client-side; videos are size-checked as-is.
 */
export async function uploadMedia(file: File): Promise<UploadedMedia> {
  const kind: "image" | "video" | "audio" = file.type.startsWith("video/")
    ? "video"
    : file.type.startsWith("audio/")
      ? "audio"
      : "image";
  let payload: Blob = file;
  let contentType = file.type;

  if (kind === "video") {
    if (!(LIMITS.allowedVideoTypes as readonly string[]).includes(file.type)) {
      throw new Error("unsupported-type");
    }
    if (file.size > LIMITS.maxVideoBytes) throw new Error("too-large");
  } else if (kind === "audio") {
    if (!(LIMITS.allowedAudioTypes as readonly string[]).includes(file.type)) {
      throw new Error("unsupported-type");
    }
    if (file.size > LIMITS.maxAudioBytes) throw new Error("too-large");
  } else {
    payload = await compressImage(file);
    contentType = "image/webp";
    if (payload.size > LIMITS.maxImageBytes) {
      // Retry with stronger compression before giving up.
      payload = await compressImage(file, { maxDimension: 1280, quality: 0.7 });
      if (payload.size > LIMITS.maxImageBytes) throw new Error("too-large");
    }
  }

  const dims = kind === "image" ? await imageDimensions(payload) : null;

  const form = new FormData();
  form.append(
    "file",
    new File([payload], file.name, { type: contentType }),
  );
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const json = (await res.json()) as {
    data?: { txId: string; size: number; costMicroUsd?: number };
    error?: { code: string };
  };
  if (!res.ok || !json.data) {
    throw new Error(json.error?.code ?? "upload-failed");
  }

  return {
    txId: json.data.txId,
    kind,
    contentType,
    size: json.data.size,
    ...(dims ?? {}),
    previewUrl: URL.createObjectURL(payload),
    costMicroUsd: json.data.costMicroUsd ?? 0,
  };
}

async function imageDimensions(
  blob: Blob,
): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return null;
  }
}
