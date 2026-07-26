"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import CreateFlow, { type EditContext } from "@/components/create/CreateFlow";
import { useI18n } from "@/i18n/client";
import { getGatewayUrl } from "@/lib/irys/config";
import { getKey, importKey } from "@/lib/client/keystore";
import type { MemorialManifest } from "@/lib/memorial/schema";

type State =
  | { status: "loading" }
  | { status: "no-key" }
  | { status: "error" }
  | { status: "ready"; edit: EditContext };

/** Loads the stored key + current manifest, then hands off to the wizard. */
export default function EditLoader({ memorialId }: { memorialId: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ status: "loading" });
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    const storedKey = getKey(memorialId);
    if (!storedKey) {
      setState({ status: "no-key" });
      return;
    }
    try {
      const res = await fetch(
        `/api/memorial?id=${encodeURIComponent(memorialId)}`,
      );
      const json = (await res.json()) as {
        data?: { manifest: MemorialManifest };
      };
      if (!res.ok || !json.data) throw new Error("load failed");
      const manifest = json.data.manifest;
      const gateway = getGatewayUrl();
      const mediaUrls: Record<string, string> = {};
      if (manifest.subject.portrait) {
        mediaUrls[manifest.subject.portrait.txId] =
          `${gateway}/${manifest.subject.portrait.txId}`;
      }
      for (const ref of manifest.media) {
        mediaUrls[ref.txId] = `${gateway}/${ref.txId}`;
      }
      setState({ status: "ready", edit: { storedKey, manifest, mediaUrls } });
    } catch {
      setState({ status: "error" });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memorialId]);

  if (state.status === "loading") {
    return (
      <p className="py-24 text-center text-sm text-muted">{t.common.loading}</p>
    );
  }

  if (state.status === "no-key") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-sm leading-6 text-muted">{t.space.keyMissing}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            className="btn-primary"
            onClick={() => fileInput.current?.click()}
          >
            {t.space.importKey}
          </button>
          <Link href="/space" className="btn-outline">
            {t.common.back}
          </Link>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                importKey(String(reader.result));
                void load();
              } catch {
                /* stays on no-key screen */
              }
            };
            reader.readAsText(f);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-sm text-muted">{t.space.loadFailed}</p>
        <button
          type="button"
          className="btn-outline mt-6"
          onClick={() => {
            setState({ status: "loading" });
            void load();
          }}
        >
          {t.common.retry}
        </button>
      </div>
    );
  }

  return <CreateFlow edit={state.edit} />;
}
