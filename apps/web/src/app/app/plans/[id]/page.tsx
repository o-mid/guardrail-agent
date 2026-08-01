"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusPill } from "@/components/StatusPill";
import { API_URL, api } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

type Step = {
  index: number;
  action: string;
  status: string;
  txHash?: string | null;
  decodedSummary: string;
};
type Plan = { _id: string; summary: string; status: string; chain: string };

function parseEvent(raw: string): { label: string; detail?: string } {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const type = String(parsed.type ?? parsed.event ?? "event");
    const status = parsed.status ? ` · ${parsed.status}` : "";
    return { label: `${type}${status}`, detail: raw };
  } catch {
    return { label: raw.slice(0, 80), detail: raw };
  }
}

export default function PlanFeedPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    api<{ plan: Plan; steps: Step[] }>(`/api/plans/${id}`, { token })
      .then((d) => {
        setPlan(d.plan);
        setSteps(d.steps);
      })
      .catch(() => router.replace("/app"));

    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/plans/${id}/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const data = line.slice(6);
            setEvents((prev) => [data, ...prev].slice(0, 50));
            try {
              const parsed = JSON.parse(data) as { status?: string };
              if (parsed.status) {
                setPlan((p) => (p ? { ...p, status: parsed.status! } : p));
              }
            } catch {
              // heartbeat
            }
            const refreshed = await api<{ plan: Plan; steps: Step[] }>(`/api/plans/${id}`, { token });
            setPlan(refreshed.plan);
            setSteps(refreshed.steps);
          }
        }
      } catch {
        // closed
      }
    })();

    return () => ctrl.abort();
  }, [id, router]);

  if (!plan) {
    return <p className="text-sm text-ink-muted">Loading execution feed…</p>;
  }

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Execution feed</h1>
          <p className="mt-2 text-sm text-ink-muted">{plan.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-muted">{plan.chain}</span>
            <StatusPill status={plan.status} />
          </div>
        </div>
        <Link href="/app/compose" className="text-sm font-medium text-accent hover:underline">
          Back to Compose
        </Link>
      </header>

      <section aria-label="Step machine">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">Steps</h2>
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.index} className="border border-line bg-surface px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-ink-muted">#{s.index}</span>
                <span className="text-sm font-medium">{s.action}</span>
                <StatusPill status={s.status} />
              </div>
              <p className="mt-1 text-sm text-ink-muted">{s.decodedSummary}</p>
              {s.txHash ? (
                <p className="mt-2 font-mono text-xs text-ink-muted">
                  tx: <span className="text-ink">{s.txHash}</span>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-label="Live events">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
          SSE events
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-ink-muted">Waiting for events…</p>
        ) : (
          <ol className="divide-y divide-line border border-line bg-surface">
            {events.map((e, i) => {
              const { label, detail } = parseEvent(e);
              return (
                <li key={`${i}-${e.slice(0, 16)}`} className="px-4 py-2.5">
                  <p className="text-sm font-medium text-ink">{label}</p>
                  {detail && detail !== label ? (
                    <p className="mt-0.5 truncate font-mono text-xs text-ink-muted" title={detail}>
                      {detail}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
