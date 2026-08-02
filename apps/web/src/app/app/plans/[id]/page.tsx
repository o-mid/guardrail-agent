"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { StepRow, type StepDetail } from "@/components/StepRow";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { usePlanStream } from "@/lib/usePlanStream";

type Plan = {
  _id: string;
  summary: string;
  status: string;
  chain: string;
  policyVersion?: number;
  schemaVersion?: string;
};

function parseEvent(raw: string): { label: string; detail?: string } {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const type = String(parsed.type ?? parsed.event ?? "event");
    const status = parsed.status ? ` · ${parsed.status}` : "";
    const index = parsed.index !== undefined ? ` · #${parsed.index}` : "";
    return { label: `${type}${status}${index}`, detail: raw };
  } catch {
    return { label: raw.slice(0, 80), detail: raw };
  }
}

export default function PlanFeedPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [steps, setSteps] = useState<StepDetail[]>([]);
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    api<{ plan: Plan; steps: StepDetail[] }>(`/api/plans/${id}`, { token })
      .then((d) => {
        setPlan(d.plan);
        setSteps(d.steps);
      })
      .catch(() => router.replace("/app"));
  }, [id, router]);

  const onStream = useCallback((bundle: { plan: Plan; steps: StepDetail[] }, raw: string) => {
    setPlan(bundle.plan);
    setSteps(bundle.steps);
    setEvents((prev) => [raw, ...prev].slice(0, 50));
  }, []);

  usePlanStream(id, onStream);

  if (!plan) {
    return <p className="text-sm text-ink-muted">Loading execution feed…</p>;
  }

  return (
    <div>
      <PageHeader
        title="Execution feed"
        description={plan.summary}
        actions={
          <Link href="/app/compose" className="text-sm font-medium text-accent hover:underline">
            Back to Compose
          </Link>
        }
      />
      <div className="mb-8 flex flex-wrap items-center gap-2 text-sm">
        <span className="border border-line bg-surface px-2 py-0.5 font-mono text-xs text-ink-muted">
          {plan.chain}
        </span>
        <StatusPill status={plan.status} />
        {plan.policyVersion != null ? (
          <span className="font-mono text-xs text-ink-muted">policy v{plan.policyVersion}</span>
        ) : null}
      </div>

      <section aria-label="Step machine">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Live step transform
        </h2>
        <ul className="space-y-2">
          {steps.map((s) => (
            <StepRow key={s.index} {...s} />
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
                <li
                  key={`${i}-${e.slice(0, 16)}`}
                  className="px-4 py-2.5 motion-safe:animate-step-enter"
                >
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
