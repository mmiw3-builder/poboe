"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Internal moderation console (token-gated, noindex). Deliberately minimal:
 * wallet status, report queue, hide/unhide actions. The hide list only
 * affects what this site renders — chain data is immutable.
 */

interface ReportRow {
  txId: string;
  report: {
    targetType: "memorial" | "tribute" | "contribution";
    targetId: string;
    reason: string;
    createdAt: number;
  };
}

interface Status {
  address: string;
  network: string;
  balance: string;
  pricePerMb: string;
}

export default function AdminPanel() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [manualType, setManualType] = useState<
    "memorial" | "tribute" | "contribution"
  >("memorial");
  const [manualId, setManualId] = useState("");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      const saved = sessionStorage.getItem("poboe_admin_token");
      if (saved && !cancelled) setToken(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(
    async (tok: string) => {
      setBusy(true);
      setMessage(null);
      try {
        const headers = { Authorization: `Bearer ${tok}` };
        const [statusRes, reportsRes] = await Promise.all([
          fetch("/api/admin/status", { headers }),
          fetch("/api/admin/moderate", { headers }),
        ]);
        if (statusRes.status === 401 || reportsRes.status === 401) {
          setAuthed(false);
          setMessage("Token 无效 / invalid token");
          return;
        }
        const statusJson = (await statusRes.json()) as { data?: Status };
        const reportsJson = (await reportsRes.json()) as {
          data?: { reports: ReportRow[] };
        };
        setStatus(statusJson.data ?? null);
        setReports(reportsJson.data?.reports ?? []);
        setAuthed(true);
        sessionStorage.setItem("poboe_admin_token", tok);
      } catch {
        setMessage("加载失败 / load failed");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  async function act(
    action: "hide" | "unhide",
    targetType: "memorial" | "tribute" | "contribution",
    targetId: string,
  ) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/moderate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, targetType, targetId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setMessage(`${action} ${targetId} — 已发布签名审核记录`);
    } catch (e) {
      setMessage(`操作失败 / failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm px-4 py-24">
        <h1 className="text-center font-serif text-2xl font-semibold">
          Admin Console
        </h1>
        <input
          type="password"
          className="input mt-6"
          placeholder="ADMIN_TOKEN"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button
          type="button"
          className="btn-primary mt-4 w-full"
          disabled={busy || !token}
          onClick={() => void load(token)}
        >
          {busy ? "…" : "进入 / Enter"}
        </button>
        {message && (
          <p className="mt-4 text-center text-sm text-red-500">{message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-2xl font-semibold">Admin Console</h1>

      {status && (
        <div className="mt-6 grid gap-2 rounded-xl border border-border bg-surface p-4 text-xs sm:grid-cols-2">
          <p>网络 network: {status.network}</p>
          <p className="break-all">钱包 wallet: {status.address}</p>
          <p>余额 balance: {status.balance}</p>
          <p>价格 price/MB: {status.pricePerMb}</p>
        </div>
      )}

      {message && <p className="mt-4 text-sm text-accent">{message}</p>}

      <section className="mt-8">
        <h2 className="font-serif text-lg font-semibold">
          手动操作 / Manual action
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            className="input !w-auto"
            value={manualType}
            onChange={(e) =>
              setManualType(
                e.target.value as "memorial" | "tribute" | "contribution",
              )
            }
          >
            <option value="memorial">memorial (id)</option>
            <option value="tribute">tribute (txId)</option>
            <option value="contribution">contribution (txId)</option>
          </select>
          <input
            className="input !w-64"
            placeholder="target id"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
          />
          <button
            type="button"
            className="btn-outline !h-9 !px-4 text-xs"
            disabled={busy || !manualId}
            onClick={() => void act("hide", manualType, manualId.trim())}
          >
            隐藏 hide
          </button>
          <button
            type="button"
            className="btn-outline !h-9 !px-4 text-xs"
            disabled={busy || !manualId}
            onClick={() => void act("unhide", manualType, manualId.trim())}
          >
            恢复 unhide
          </button>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold">
            举报队列 / Reports ({reports.length})
          </h2>
          <button
            type="button"
            className="btn-outline !h-8 !px-3 text-xs"
            disabled={busy}
            onClick={() => void load(token)}
          >
            刷新 refresh
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {reports.length === 0 ? (
            <p className="text-sm text-muted">暂无举报 / no reports</p>
          ) : (
            reports.map((r) => (
              <div
                key={r.txId}
                className="rounded-xl border border-border bg-surface p-4 text-sm"
              >
                <p className="text-xs text-muted">
                  {r.report.targetType} · {r.report.targetId} ·{" "}
                  {new Date(r.report.createdAt).toLocaleString()}
                </p>
                <p className="mt-2 leading-6">{r.report.reason}</p>
                <div className="mt-3 flex gap-2">
                  <a
                    className="btn-outline !h-8 !px-3 text-xs"
                    href={
                      r.report.targetType === "memorial"
                        ? `/m/${r.report.targetId}`
                        : "#"
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看 view
                  </a>
                  <button
                    type="button"
                    className="btn-primary !h-8 !px-3 text-xs"
                    disabled={busy}
                    onClick={() =>
                      void act("hide", r.report.targetType, r.report.targetId)
                    }
                  >
                    隐藏 hide
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
