"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { listKeys } from "@/lib/client/keystore";
import { listAccountSpaces } from "@/lib/client/keysync";
import { lifeDates } from "@/lib/memorial/display";
import { tileGradientCss as tileGradient } from "@/lib/personalHue";

/**
 * 记忆星海 — the Sea of Memory. The whole page is people: every life is a
 * star laid out on a phyllotaxis spiral (r = c·√i, θ = i·137.5°, the
 * sunflower pattern — organic, never grid-neat, and it never overlaps).
 * Drag to roam, wheel/pinch to zoom. Three reading distances:
 *   far   — a field of glimmering stars
 *   mid   — faces and names
 *   near  — dates and their one line
 * Click a star to enter that life. The center star is yours to light.
 */

export interface UniversePerson {
  id: string;
  name: string;
  living?: boolean;
  altName?: string;
  born?: string;
  died?: string;
  epitaph?: string;
  portraitUrl?: string;
}

const GOLDEN_ANGLE = 137.50776405003785 * (Math.PI / 180);
/** World-space distance between spiral rings; nodes are ~96 world px wide. */
const SPACING = 120;
const NODE = 96;
const MAX_SCALE = 1.8;
/** The hero overlay owns the top of the section; the spiral heart sits lower. */
const CENTER_Y = 0.58;

/** Star → face at 0.34; face → card at 0.85 (screen px per world px). */
const LOD_FACE = 0.34;
const LOD_CARD = 0.85;

function spiral(i: number): { x: number; y: number } {
  const k = i + 1;
  const r = SPACING * Math.sqrt(k);
  const a = k * GOLDEN_ANGLE;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}

interface Camera {
  tx: number;
  ty: number;
  scale: number;
}

export default function MemoryUniverse({
  people,
}: {
  people: UniversePerson[];
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    // Which stars are the visitor's own: browser keys + account custody.
    queueMicrotask(() => {
      const ids = new Set(listKeys().map((k) => k.memorialId));
      if (!cancelled && ids.size > 0) setMine(new Set(ids));
      void listAccountSpaces().then((spaces) => {
        if (cancelled || spaces.length === 0) return;
        setMine((prev) => {
          const next = new Set(prev);
          for (const s of spaces) next.add(s.memorialId);
          return next;
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fit-all scale for the reset view, derived from the outermost ring.
  const fitScale = useCallback(
    (w: number, h: number) => {
      const radius = SPACING * Math.sqrt(people.length + 1) + NODE;
      return Math.min(MAX_SCALE, (Math.min(w, h) * 0.46) / radius);
    },
    [people.length],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!size || camera) return;
    let cancelled = false;
    // Deferred: the opening camera depends on the measured viewport.
    queueMicrotask(() => {
      if (cancelled) return;
      setCamera({
        tx: size.w / 2,
        ty: size.h * CENTER_Y,
        scale: fitScale(size.w, size.h),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [size, camera, fitScale]);

  const minScale = size ? fitScale(size.w, size.h) * 0.55 : 0.05;

  const clampCamera = useCallback(
    (cam: Camera): Camera => {
      if (!size) return cam;
      const radius = SPACING * Math.sqrt(people.length + 1) + NODE;
      const maxOff = radius * cam.scale + Math.min(size.w, size.h) * 0.4;
      return {
        scale: cam.scale,
        tx: Math.min(size.w / 2 + maxOff, Math.max(size.w / 2 - maxOff, cam.tx)),
        ty: Math.min(size.h / 2 + maxOff, Math.max(size.h / 2 - maxOff, cam.ty)),
      };
    },
    [size, people.length],
  );

  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      setCamera((cam) => {
        if (!cam) return cam;
        const scale = Math.min(
          MAX_SCALE,
          Math.max(minScale, cam.scale * factor),
        );
        const k = scale / cam.scale;
        return clampCamera({
          scale,
          tx: cx - (cx - cam.tx) * k,
          ty: cy - (cy - cam.ty) * k,
        });
      });
    },
    [minScale, clampCamera],
  );

  // Wheel zoom needs a non-passive listener to preventDefault page scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(
        e.clientX - rect.left,
        e.clientY - rect.top,
        Math.exp(-e.deltaY * 0.0016),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Pointer pan + two-finger pinch. Clicks are suppressed after a drag.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const movedRef = useRef(0);
  const pinchDist = useRef(0);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) movedRef.current = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);

    if (pointers.current.size === 1) {
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      movedRef.current += Math.abs(dx) + Math.abs(dy);
      setCamera((cam) =>
        cam ? clampCamera({ ...cam, tx: cam.tx + dx, ty: cam.ty + dy }) : cam,
      );
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist.current > 0) {
        const rect = containerRef.current?.getBoundingClientRect();
        const mx = (a.x + b.x) / 2 - (rect?.left ?? 0);
        const my = (a.y + b.y) / 2 - (rect?.top ?? 0);
        zoomAt(mx, my, dist / pinchDist.current);
        movedRef.current += 10;
      }
      pinchDist.current = dist;
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    pinchDist.current = 0;
  }

  function onClickCapture(e: React.MouseEvent) {
    if (movedRef.current > 6) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  const positions = useMemo(
    () => people.map((_, i) => spiral(i)),
    [people],
  );

  const scale = camera?.scale ?? 0;
  const lod: "star" | "face" | "card" =
    scale >= LOD_CARD ? "card" : scale >= LOD_FACE ? "face" : "star";

  // Virtualization: only mount nodes near the viewport.
  const visible = useMemo(() => {
    if (!camera || !size) return [];
    const margin = NODE * camera.scale + 140;
    const out: number[] = [];
    for (let i = 0; i < positions.length; i += 1) {
      const sx = camera.tx + positions[i].x * camera.scale;
      const sy = camera.ty + positions[i].y * camera.scale;
      if (
        sx > -margin &&
        sx < size.w + margin &&
        sy > -margin &&
        sy < size.h + margin
      ) {
        out.push(i);
      }
    }
    return out;
  }, [camera, size, positions]);

  return (
    <div
      ref={containerRef}
      className="universe-bg relative h-full w-full cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      role="region"
      aria-label={t.wall.title}
    >
      {camera && (
        <div
          className="absolute left-0 top-0 will-change-transform"
          style={{
            transform: `translate(${camera.tx}px, ${camera.ty}px) scale(${camera.scale})`,
            transformOrigin: "0 0",
          }}
        >
          {/* The center star is unlit — an invitation. */}
          <Link
            href="/create"
            className="group absolute block"
            style={{
              transform: "translate(-50%, -50%)",
              width: NODE,
              height: NODE,
            }}
            aria-label={t.universe.createStar}
          >
            <span className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-full border border-dashed border-accent/60 bg-halo text-accent transition-colors group-hover:border-accent">
              <span className="font-serif text-2xl leading-none">+</span>
              {lod !== "star" && (
                <span className="px-2 text-center text-[10px] leading-tight">
                  {t.universe.createStar}
                </span>
              )}
            </span>
          </Link>

          {visible.map((i) => {
            const p = people[i];
            const pos = positions[i];
            const isMine = mine.has(p.id);
            return (
              <Link
                key={p.id}
                href={`/m/${p.id}`}
                className="group absolute block hover:z-20"
                style={{
                  left: pos.x,
                  top: pos.y,
                  transform: "translate(-50%, -50%)",
                  width: lod === "card" ? NODE * 2.2 : NODE,
                }}
                aria-label={p.name}
                title={lod === "star" ? p.name : undefined}
                draggable={false}
              >
                {lod === "star" ? (
                  <span className="flex items-center justify-center">
                    <span
                      className={`star-node block rounded-full ${
                        p.living ? "star-node--living" : ""
                      } ${isMine ? "star-node--mine" : ""}`}
                      style={{
                        width: isMine ? 20 : 16,
                        height: isMine ? 20 : 16,
                        background: p.living
                          ? "var(--life)"
                          : "var(--accent)",
                        ["--tw" as string]: `${(i % 7) * 0.45}s`,
                      }}
                    />
                  </span>
                ) : lod === "face" ? (
                  <span className="flex flex-col items-center gap-1.5">
                    {isMine && (
                      <span className="rounded-full border border-accent/60 bg-halo px-2 py-0.5 text-[9px] tracking-wide text-accent">
                        {t.universe.myStar}
                      </span>
                    )}
                    <Avatar p={p} sizePx={NODE - 28} mine={isMine} />
                    <span className="max-w-full truncate text-center font-serif text-[13px] leading-tight text-foreground/90">
                      {p.living && (
                        <span
                          className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                          style={{ background: "var(--life)" }}
                          aria-hidden
                        />
                      )}
                      {p.name}
                    </span>
                  </span>
                ) : (
                  <span
                    className={`flex flex-col items-center rounded-2xl border bg-surface/90 px-4 py-4 text-center backdrop-blur transition-colors group-hover:border-accent/60 ${
                      isMine ? "border-accent/60" : "border-border"
                    }`}
                  >
                    {isMine && (
                      <span className="mb-1.5 rounded-full border border-accent/60 bg-halo px-2 py-0.5 text-[9px] tracking-wide text-accent">
                        {t.universe.myStar}
                      </span>
                    )}
                    <Avatar p={p} sizePx={NODE - 32} mine={isMine} />
                    <span className="mt-2 font-serif text-sm font-semibold leading-tight">
                      {p.name}
                    </span>
                    <span className="mt-0.5 text-[10px] tracking-[0.12em] text-muted">
                      {p.living && (
                        <span
                          className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                          style={{ background: "var(--life)" }}
                          aria-hidden
                        />
                      )}
                      {lifeDates(
                        {
                          born: p.born,
                          died: p.died,
                          status: p.living ? "living" : undefined,
                        },
                        t.memorial.present,
                      ) || (p.living ? t.memorial.livingBadge : "")}
                    </span>
                    {p.epitaph && (
                      <span className="mt-1.5 line-clamp-2 font-serif text-[11px] italic leading-4 text-foreground/70">
                        「{p.epitaph}」
                      </span>
                    )}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        {(
          [
            ["+", t.universe.zoomIn, 1.35],
            ["−", t.universe.zoomOut, 1 / 1.35],
          ] as const
        ).map(([label, aria, factor]) => (
          <button
            key={label}
            type="button"
            aria-label={aria}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/85 text-lg backdrop-blur transition-colors hover:border-accent hover:text-accent"
            onClick={() =>
              size && zoomAt(size.w / 2, size.h / 2, factor)
            }
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          aria-label={t.universe.reset}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/85 text-sm backdrop-blur transition-colors hover:border-accent hover:text-accent"
          onClick={() =>
            size &&
            setCamera({
              tx: size.w / 2,
              ty: size.h * CENTER_Y,
              scale: fitScale(size.w, size.h),
            })
          }
        >
          ⤢
        </button>
        {size &&
          (() => {
            const idx = people.findIndex((p) => mine.has(p.id));
            if (idx < 0) return null;
            const pos = positions[idx];
            return (
              <button
                type="button"
                aria-label={t.universe.findMine}
                title={t.universe.findMine}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/60 bg-background/85 text-sm text-accent backdrop-blur transition-colors hover:border-accent"
                onClick={() =>
                  setCamera({
                    scale: 0.7,
                    tx: size.w / 2 - pos.x * 0.7,
                    ty: size.h * 0.5 - pos.y * 0.7,
                  })
                }
              >
                ★
              </button>
            );
          })()}
      </div>

      {/* Count + roam hint */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 text-xs text-muted">
        <p>
          {t.wall.remembered}{" "}
          <span className="font-serif text-base text-accent">
            {people.length}
          </span>{" "}
          {t.wall.people}
        </p>
        <p className="mt-1 hidden sm:block">{t.universe.hint}</p>
      </div>
    </div>
  );
}

function Avatar({
  p,
  sizePx,
  mine,
}: {
  p: UniversePerson;
  sizePx: number;
  mine?: boolean;
}) {
  return (
    <span
      className={`relative block overflow-hidden rounded-full ${
        mine ? "ring-2 ring-accent" : "ring-1 ring-border"
      }`}
      style={{ width: sizePx, height: sizePx }}
    >
      {p.portraitUrl ? (
        <Image
          src={p.portraitUrl}
          alt=""
          fill
          sizes="96px"
          className="object-cover"
          draggable={false}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-serif text-white/90"
          style={{ background: tileGradient(p.id), fontSize: sizePx * 0.42 }}
        >
          {p.name.slice(0, 1)}
        </span>
      )}
    </span>
  );
}
