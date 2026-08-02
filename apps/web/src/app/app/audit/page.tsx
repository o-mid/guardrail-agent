"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

type Event = {
  _id: string;
  type: string;
  entityId: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

type Tone = "neutral" | "accent" | "danger" | "warn";

const TYPE_META: Record<string, { label: string; tone: Tone }> = {
  "intent.received": { label: "Intent received", tone: "neutral" },
  "intent.planner_unavailable": { label: "Planner unavailable", tone: "danger" },
  "intent.policy_unreachable": { label: "Policy unreachable", tone: "danger" },
  "plan.awaiting_approval": { label: "Awaiting approval", tone: "warn" },
  "plan.rejected_policy": { label: "Rejected by policy", tone: "danger" },
  "plan.rejected_schema": { label: "Rejected by schema", tone: "danger" },
  "plan.completed": { label: "Plan completed", tone: "accent" },
  "plan.cancelled": { label: "Plan cancelled", tone: "neutral" },
  "step.approved": { label: "Step approved", tone: "accent" },
  "step.succeeded": { label: "Step succeeded", tone: "accent" },
  "step.failed": { label: "Step failed", tone: "danger" },
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "reject", label: "Rejects" },
  { id: "success", label: "Success" },
  { id: "intent", label: "Intents" },
  { id: "step", label: "Steps" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function metaFor(type: string): { label: string; tone: Tone } {
  if (TYPE_META[type]) return TYPE_META[type];
  if (type.includes("reject") || type.includes("fail")) {
    return { label: type.replace(/[._]/g, " "), tone: "danger" };
  }
  if (type.includes("succeed") || type.includes("completed") || type.includes("approved")) {
    return { label: type.replace(/[._]/g, " "), tone: "accent" };
  }
  return { label: type.replace(/[._]/g, " "), tone: "neutral" };
}

function matchesFilter(type: string, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "reject") return type.includes("reject") || type.includes("fail");
  if (filter === "success") {
    return (
      type.includes("succeed") || type.includes("completed") || type === "step.approved"
    );
  }
  if (filter === "intent") return type.startsWith("intent.");
  if (filter === "step") return type.startsWith("step.");
  return true;
}

function toneDot(tone: Tone): string {
  if (tone === "danger") return "border-danger bg-danger";
  if (tone === "accent") return "border-accent bg-accent";
  if (tone === "warn") return "border-accent/60 bg-accent/40";
  return "border-line bg-canvas-subtle";
}

function toneBadge(tone: Tone): string {
  if (tone === "danger") return "border-danger/30 bg-danger-bg text-danger";
  if (tone === "accent") return "border-accent/30 bg-accent/10 text-accent";
  if (tone === "warn") return "border-line bg-canvas-subtle text-ink";
  return "border-line bg-canvas-subtle text-ink-muted";
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${Math.max(sec, 0)}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function payloadSummary(type: string, payload?: Record<string, unknown>): string | null {
  if (!payload || Object.keys(payload).length === 0) return null;
  if (Array.isArray(payload.policyCodes) && payload.policyCodes.length) {
    return (payload.policyCodes as string[]).join(", ");
  }
  if (typeof payload.txHash === "string") return `tx ${payload.txHash}`;
  if (typeof payload.error === "string") return shortenError(payload.error);
  if (typeof payload.chain === "string" && typeof payload.steps === "number") {
    return `${payload.chain} · ${payload.steps} step${payload.steps === 1 ? "" : "s"}`;
  }
  if (typeof payload.index === "number") return `step #${payload.index}`;
  if (type.startsWith("intent.") && typeof payload.text === "string") {
    const t = payload.text;
    return t.length > 80 ? `${t.slice(0, 80)}…` : t;
  }
  return null;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Pull a short human reason out of ethers-style error blobs. */
function shortenError(text: string): string {
  const nonce = text.match(/nonce too low|NONCE_EXPIRED|nonce has already been used/i);
  if (nonce) return "Anvil nonce conflict — retry the step (usually a double-submit).";
  const code = text.match(/code=([A-Z_]+)/);
  const msg = text.match(/"message":"([^"]+)"/);
  if (code && msg) return `${msg[1]} (${code[1]})`;
  if (msg) return msg[1];
  if (text.length <= 140) return text;
  return `${text.slice(0, 120)}…`;
}

const inputClass =
  "w-full border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

export default function AuditPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [entityId, setEntityId] = useState("");
  const [entityDraft, setEntityDraft] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setEntityId(entityDraft.trim()), 280);
    return () => window.clearTimeout(t);
  }, [entityDraft]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const q = entityId ? `?entityId=${encodeURIComponent(entityId)}` : "";
    api<{ events: Event[] }>(`/api/audit${q}`, { token })
      .then((d) => {
        if (!cancelled) setEvents(d.events);
      })
      .catch((err) => {
        if (cancelled) return;
        setEvents([]);
        setError(err instanceof Error ? err.message : "audit_failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId, router]);

  function refresh() {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    const q = entityId ? `?entityId=${encodeURIComponent(entityId)}` : "";
    api<{ events: Event[] }>(`/api/audit${q}`, { token })
      .then((d) => setEvents(d.events))
      .catch((err) => {
        setEvents([]);
        setError(err instanceof Error ? err.message : "audit_failed");
      })
      .finally(() => setLoading(false));
  }

  const filtered = useMemo(
    () => events.filter((ev) => matchesFilter(ev.type, filter)),
    [events, filter],
  );

  const counts = useMemo(() => {
    let rejects = 0;
    let success = 0;
    let steps = 0;
    for (const ev of events) {
      if (ev.type.includes("reject") || ev.type.includes("fail")) rejects += 1;
      if (
        ev.type.includes("succeed") ||
        ev.type.includes("completed") ||
        ev.type === "step.approved"
      ) {
        success += 1;
      }
      if (ev.type.startsWith("step.")) steps += 1;
    }
    return { total: events.length, rejects, success, steps };
  }, [events]);

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div>
      <PageHeader
        title="Audit"
        description="Decision log for intents, policy gates, and step execution."
        actions={
          <Button variant="secondary" className="text-sm" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      <section
        aria-label="Audit summary"
        className="mb-6 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4"
      >
        {[
          { label: "Events", value: counts.total },
          { label: "Rejects / fails", value: counts.rejects },
          { label: "Approvals / ok", value: counts.success },
          { label: "Step events", value: counts.steps },
        ].map((item) => (
          <div key={item.label} className="bg-surface px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              {item.label}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
              {loading ? "—" : item.value}
            </p>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-4 border border-line bg-surface p-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="block min-w-0 flex-1 text-sm font-medium text-ink">
          Entity ID
          <input
            className={`${inputClass} mt-1.5`}
            value={entityDraft}
            onChange={(e) => setEntityDraft(e.target.value)}
            placeholder="Filter by plan or intent id"
            spellCheck={false}
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Event type filter">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-canvas-subtle text-ink-muted hover:border-accent hover:text-accent"
                }`}
                aria-pressed={active}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-sm border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-8">
        {loading ? (
          <ul className="space-y-3" aria-label="Loading audit events">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-20 animate-pulse border border-line bg-surface"
                style={{ opacity: 1 - i * 0.15 }}
              />
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-line bg-surface px-6 py-12 text-center">
            <p className="font-display text-lg font-semibold text-ink">No matching events</p>
            <p className="mt-1 text-sm text-ink-muted">
              {events.length === 0
                ? "Create a plan from Compose to populate the timeline."
                : "Try another filter or clear the entity ID."}
            </p>
            <Link
              href="/app/compose"
              className="mt-4 inline-block text-sm font-medium text-accent hover:underline"
            >
              Open Compose
            </Link>
          </div>
        ) : (
          <ol className="relative space-y-0 border-l border-line pl-6" aria-label="Audit timeline">
            {filtered.map((ev, i) => {
              const meta = metaFor(ev.type);
              const open = !!expanded[ev._id];
              const summary = payloadSummary(ev.type, ev.payload);
              const hasPayload = !!ev.payload && Object.keys(ev.payload).length > 0;
              const planLink = ev.type.startsWith("plan.") || ev.type.startsWith("step.");

              return (
                <li
                  key={ev._id}
                  className="relative pb-6 last:pb-0 motion-safe:animate-step-enter"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <span
                    className={`absolute -left-[31px] top-3 h-2.5 w-2.5 rounded-full border-2 ${toneDot(meta.tone)}`}
                    aria-hidden="true"
                  />

                  <article className="border border-line bg-surface px-4 py-3 transition-colors hover:border-accent/40">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${toneBadge(meta.tone)}`}
                          >
                            {meta.label}
                          </span>
                          <code className="font-mono text-[11px] text-ink-muted">{ev.type}</code>
                        </div>
                        {summary ? (
                          <p className="mt-2 text-sm text-ink">{summary}</p>
                        ) : (
                          <p className="mt-2 text-sm text-ink-muted">No summary payload</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                          <span className="font-mono" title={ev.entityId}>
                            {ev.entityId}
                          </span>
                          {planLink ? (
                            <Link
                              href={`/app/plans/${ev.entityId}`}
                              className="font-medium text-accent hover:underline"
                            >
                              Open feed
                            </Link>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <time
                          className="text-right text-xs text-ink-muted"
                          dateTime={ev.createdAt}
                          title={new Date(ev.createdAt).toLocaleString()}
                        >
                          <span className="block font-medium text-ink">{relativeTime(ev.createdAt)}</span>
                          <span className="mt-0.5 block">
                            {new Date(ev.createdAt).toLocaleString()}
                          </span>
                        </time>
                        {hasPayload ? (
                          <button
                            type="button"
                            onClick={() => toggle(ev._id)}
                            className="text-xs font-medium text-accent hover:underline"
                            aria-expanded={open}
                          >
                            {open ? "Hide details" : "Show details"}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {open && hasPayload ? (
                      <dl className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
                        {Object.entries(ev.payload!).map(([key, value]) => {
                          const raw = formatValue(value);
                          const display =
                            key === "error" && typeof value === "string" ? shortenError(value) : raw;
                          return (
                            <div key={key} className={key === "error" ? "min-w-0 sm:col-span-2" : "min-w-0"}>
                              <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                                {key}
                              </dt>
                              <dd
                                className={`mt-0.5 font-mono text-xs text-ink ${
                                  key === "error" ? "whitespace-pre-wrap break-all" : "truncate"
                                }`}
                                title={raw}
                              >
                                {display}
                              </dd>
                            </div>
                          );
                        })}
                      </dl>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
