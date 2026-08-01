"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusPill } from "@/components/StatusPill";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

type Event = {
  _id: string;
  type: string;
  entityId: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

const TYPE_LABELS: Record<string, string> = {
  intent_created: "Intent created",
  plan_created: "Plan created",
  plan_approved: "Plan approved",
  plan_rejected: "Plan rejected",
  step_approved: "Step approved",
  step_executed: "Step executed",
  step_failed: "Step failed",
  policy_violation: "Policy violation",
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

const inputClass =
  "mt-1.5 w-full border border-line bg-surface px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

export default function AuditPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [entityId, setEntityId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    const q = entityId ? `?entityId=${encodeURIComponent(entityId)}` : "";
    api<{ events: Event[] }>(`/api/audit${q}`, { token })
      .then((d) => setEvents(d.events))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [entityId, router]);

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink">Audit</h1>
        <p className="mt-1 text-sm text-ink-muted">Chronological record of intents, plans, and steps.</p>
      </header>

      <label className="block max-w-md text-sm font-medium text-ink">
        Filter by entity ID
        <input
          className={inputClass}
          value={entityId}
          onChange={(e) => setEntityId(e.target.value.trim())}
          placeholder="Plan or intent ID"
        />
      </label>

      <div className="mt-8">
        {loading ? (
          <p className="text-sm text-ink-muted">Loading events…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-ink-muted">No events found.</p>
        ) : (
          <ol className="relative border-l-2 border-line pl-6" aria-label="Audit timeline">
            {events.map((ev) => (
              <li key={ev._id} className="relative pb-8 last:pb-0">
                <span
                  className="absolute -left-[9px] top-1.5 h-3 w-3 rounded-full border-2 border-line bg-surface"
                  aria-hidden="true"
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{typeLabel(ev.type)}</span>
                    <StatusPill status={ev.type.includes("reject") || ev.type.includes("fail") ? "failed" : "succeeded"} />
                  </div>
                  <time className="text-xs text-ink-muted" dateTime={ev.createdAt}>
                    {new Date(ev.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-1 font-mono text-xs text-ink-muted">{ev.entityId}</p>
                {ev.payload && Object.keys(ev.payload).length > 0 ? (
                  <pre className="mt-2 overflow-x-auto rounded-sm border border-line bg-canvas-subtle p-3 font-mono text-xs text-ink-muted">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
