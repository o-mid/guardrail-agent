"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL, api } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

type Step = { index: number; action: string; status: string; txHash?: string | null; decodedSummary: string };
type Plan = { _id: string; summary: string; status: string; chain: string };

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

    const es = new EventSource(`${API_URL}/api/plans/${id}/stream?access_token=${encodeURIComponent(token)}`);
    // EventSource cannot set Authorization; use query fallback via polyfill fetch stream below if needed.
    es.close();

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
            setEvents((prev) => [data, ...prev].slice(0, 40));
            try {
              const parsed = JSON.parse(data) as { status?: string };
              if (parsed.status) {
                setPlan((p) => (p ? { ...p, status: parsed.status! } : p));
              }
            } catch {
              // ignore non-json heartbeats
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
    return <main className="mx-auto max-w-3xl px-6 py-16 text-sm">Loading feed…</main>;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl">Execution feed</h1>
        <Link href="/app/compose" className="text-sm underline">
          Compose
        </Link>
      </div>
      <p className="mt-2 text-sm text-ink/70">
        {plan.summary} · {plan.chain} · {plan.status}
      </p>
      <ul className="mt-6 space-y-2">
        {steps.map((s) => (
          <li key={s.index} className="border border-line bg-paper/50 px-3 py-2 text-sm">
            #{s.index} {s.action} — {s.status}
            {s.txHash ? <span className="ml-2 text-xs text-ink/50">{s.txHash}</span> : null}
          </li>
        ))}
      </ul>
      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-ink/50">SSE events</h2>
        <ul className="mt-2 space-y-1 font-mono text-xs text-ink/70">
          {events.map((e, i) => (
            <li key={`${i}-${e.slice(0, 24)}`} className="truncate border-b border-line/50 py-1">
              {e}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
