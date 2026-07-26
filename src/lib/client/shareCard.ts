"use client";

import QRCode from "qrcode";
import { hueOf } from "@/lib/personalHue";

/**
 * Renders a vertical memorial share card (1080x1440 PNG) on a canvas:
 * portrait (or initial tile in the person's hue), name, dates, epitaph,
 * QR code to the memorial URL, brand footer.
 */

export interface ShareCardData {
  id: string;
  name: string;
  altName?: string;
  dates?: string;
  epitaph?: string;
  portraitUrl?: string;
  url: string;
  locale: "zh" | "en";
}

const W = 1080;
const H = 1440;

function serifFamily(): string {
  // Resolve the site's loaded serif stack for canvas use.
  const el = document.createElement("span");
  el.className = "font-serif";
  el.style.display = "none";
  document.body.appendChild(el);
  const family = getComputedStyle(el).fontFamily || "Georgia, serif";
  el.remove();
  return family;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderShareCard(data: ShareCardData): Promise<Blob> {
  await document.fonts.ready;
  const serif = serifFamily();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  // Paper background with a soft warm halo.
  ctx.fillStyle = "#faf9f7";
  ctx.fillRect(0, 0, W, H);
  const halo = ctx.createRadialGradient(W / 2, 430, 60, W / 2, 430, 620);
  halo.addColorStop(0, "rgba(148, 116, 58, 0.12)");
  halo.addColorStop(1, "rgba(148, 116, 58, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  // Thin border frame.
  ctx.strokeStyle = "rgba(148, 116, 58, 0.35)";
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  // Portrait circle (or initial tile).
  const cx = W / 2;
  const cy = 400;
  const r = 170;
  const img = data.portraitUrl ? await loadImage(data.portraitUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    const h = hueOf(data.id);
    const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, `hsl(${h} 30% 46%)`);
    grad.addColorStop(1, `hsl(${(h + 24) % 360} 34% 24%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `160px ${serif}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(data.name.slice(0, 1), cx, cy + 10);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(148, 116, 58, 0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Eyebrow.
  ctx.fillStyle = "#94743a";
  ctx.font = `28px ${serif}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const eyebrow = data.locale === "zh" ? "谨 以 此 念" : "IN LOVING MEMORY";
  ctx.fillText(eyebrow, cx, 680);

  // Name.
  ctx.fillStyle = "#1c1917";
  ctx.font = `600 96px ${serif}`;
  ctx.fillText(data.name, cx, 800);
  let y = 800;
  if (data.altName) {
    y += 64;
    ctx.fillStyle = "#78716c";
    ctx.font = `40px ${serif}`;
    ctx.fillText(data.altName, cx, y);
  }
  if (data.dates) {
    y += 70;
    ctx.fillStyle = "#78716c";
    ctx.font = `36px ${serif}`;
    ctx.fillText(data.dates, cx, y);
  }

  // Epitaph.
  if (data.epitaph) {
    y += 110;
    ctx.fillStyle = "#44403c";
    ctx.font = `italic 48px ${serif}`;
    const quote =
      data.locale === "zh" ? `「${data.epitaph}」` : `“${data.epitaph}”`;
    for (const line of wrapText(ctx, quote, W - 260).slice(0, 3)) {
      ctx.fillText(line, cx, y);
      y += 66;
    }
  }

  // Divider.
  ctx.strokeStyle = "rgba(148, 116, 58, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 70, H - 340);
  ctx.lineTo(cx + 70, H - 340);
  ctx.stroke();

  // QR code.
  const qrData = await QRCode.toDataURL(data.url, {
    width: 180,
    margin: 1,
    color: { dark: "#1c1917", light: "#faf9f7" },
  });
  const qrImg = await loadImage(qrData);
  if (qrImg) ctx.drawImage(qrImg, cx - 90, H - 310, 180, 180);

  // Brand footer.
  ctx.fillStyle = "#78716c";
  ctx.font = `30px ${serif}`;
  ctx.fillText(
    data.locale === "zh" ? "永铭 · EVERMARK" : "永铭 · EVERMARK",
    cx,
    H - 80,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png",
    );
  });
}
