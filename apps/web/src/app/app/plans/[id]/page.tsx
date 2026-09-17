"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PolicyReject } from "@/components/PolicyReject";
import { StatusPill } from "@/components/StatusPill";
import { StepRow, type StepDetail } from "@/components/StepRow";
import { api, type AuditEvent, type PlanIntent, type PlannerUsage } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { usePlanStream } from "@/lib/usePlanStream";

type Plan = {
  _id: string;
  summary: string;
  status: string;
  chain: string;
  policyVersion?: number;
  schemaVersion?: string;
  rejectionReasons?: string[];
  plannerLatencyMs?: number | null;
  plannerModel?: string | null;
  usage?: PlannerUsage | null;
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
  "step.rejected_policy": { label: "Approve blocked by policy", tone: "danger" },
  "step.policy_unreachable": { label: "Policy unreachable on approve", tone: "danger" },
};

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
  if (Array.isArray(payload.schemaErrors) && payload.schemaErrors.length) {
    return (payload.schemaErrors as string[]).join(", ");
  }
  if (Array.isArray(payload.humanMessages) && payload.humanMessages.length) {
    return (payload.humanMessages as string[]).join(" · ");
  }
  if (typeof payload.txHash === "string") return `tx ${payload.txHash}`;
  if (typeof payload.error === "string") return payload.error.slice(0, 140);
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

function rejectFromTrail(events: AuditEvent[], fallback: string[]): {
  policyCodes: string[];
  schemaErrors: string[];
  humanMessages: string[];
} {
  const ev = [...events]
    .reverse()
    .find(
      (e) =>
        e.type === "plan.rejected_policy" ||
        e.type === "plan.rejected_schema" ||
        e.type === "step.rejected_policy",
    );
  const payload = ev?.payload ?? {};
  const policyCodes = Array.isArray(payload.policyCodes)
    ? (payload.policyCodes as string[])
    : fallback;
  const schemaErrors = Array.isArray(payload.schemaErrors) ? (payload.schemaErrors as string[]) : [];
  const humanMessages = Array.isArray(payload.humanMessages)
    ? (payload.humanMessages as string[])
    : [];
  return { policyCodes, schemaErrors, humanMessages };
}

function plannerCostLine(plan: Plan): string | null {
  const bits: string[] = [];
  if (typeof plan.plannerLatencyMs === "number") bits.push(`${plan.plannerLatencyMs}ms`);
  if (plan.plannerModel) bits.push(plan.plannerModel);
  if (plan.usage && typeof plan.usage.promptTokens === "number") {
    bits.push(`${plan.usage.promptTokens} prompt / ${plan.usage.completionTokens} completion`);
  }
  return bits.length ? bits.join(" · ") : null;
}

function parseEvent(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const type = String(parsed.type ?? parsed.event ?? "event");
    const status = parsed.status ? ` · ${parsed.status}` : "";
    const index = parsed.index !== undefined ? ` · #${parsed.index}` : "";
    return `${type}${status}${index}`;
  } catch {
    return raw.slice(0, 80);
  }
}

type PlanDetail = {
  plan: Plan;
  steps: StepDetail[];
  intent?: PlanIntent | null;
  auditEvents?: AuditEvent[];
};

export default function PlanFeedPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [steps, setSteps] = useState<StepDetail[]>([]);
  const [intent, setIntent] = useState<PlanIntent | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [liveHint, setLiveHint] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    api<PlanDetail>(`/api/plans/${id}`, { token })
      .then((d) => {
        setPlan(d.plan);
        setSteps(d.steps);
        setIntent(d.intent ?? null);
        setAuditEvents(d.auditEvents ?? []);
      })
      .catch(() => router.replace("/app"));
  }, [id, router]);

  const onStream = useCallback((bundle: PlanDetail, raw: string) => {
    setPlan(bundle.plan);
    setSteps(bundle.steps);
    if (bundle.intent !== undefined) setIntent(bundle.intent ?? null);
    if (bundle.auditEvents) setAuditEvents(bundle.auditEvents);
    setLiveHint(parseEvent(raw));
  }, []);

  usePlanStream(id, onStream);

  if (!plan) {
    return <p className="text-sm text-ink-muted">Loading execution feed…</p>;
  }

  const rejected = plan.status.startsWith("rejected");
  const reject = rejectFromTrail(auditEvents, plan.rejectionReasons ?? []);
  const plannerLine = `${plan.chain} · ${steps.length} step${steps.length === 1 ? "" : "s"}`;
  const costLine = plannerCostLine(plan);

  return (
    <div>
      <PageHeader
        title="Execution feed"
        description={plan.summary}
        actions={
          <span className="flex flex-wrap gap-3">
            <Link href="/app/audit" className="text-sm font-medium text-accent hover:underline">
              Audit
            </Link>
            <Link href="/app/compose" className="text-sm font-medium text-accent hover:underline">
              Back to Compose
            </Link>
          </span>
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
        {liveHint ? (
          <span className="font-mono text-xs text-accent">live · {liveHint}</span>
        ) : null}
      </div>

      {rejected ? (
        <div className="mb-8 border border-line bg-surface">
          <PolicyReject
            policyCodes={reject.policyCodes.length ? reject.policyCodes : (plan.rejectionReasons ?? [])}
            humanMessages={reject.humanMessages}
            schemaErrors={reject.schemaErrors}
          />
        </div>
      ) : null}

      <section className="mb-8 border border-line bg-surface p-4" aria-label="Planner output">
        <h2 className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Planner output
        </h2>
        <p className="mt-2 text-sm text-ink">{plan.summary}</p>
        {intent?.text ? (
          <p className="mt-2 text-sm text-ink-muted">
            From intent: <span className="text-ink">&ldquo;{intent.text}&rdquo;</span>
          </p>
        ) : null}
        <p className="mt-2 font-mono text-xs text-ink-muted">
          {plannerLine}
          {plan.schemaVersion ? ` · schema ${plan.schemaVersion}` : ""}
          {rejected ? " · gated (did not execute)" : ""}
        </p>
        {costLine ? (
          <p className="mt-1 font-mono text-xs text-ink-muted">{costLine}</p>
        ) : null}
      </section>

      <section aria-label="Step machine">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Live step transform
        </h2>
        {steps.length === 0 ? (
          <p className="text-sm text-ink-muted">No steps. Rejected plans never reach approve.</p>
        ) : (
          <ul className="space-y-2">
            {steps.map((s) => (
              <StepRow key={s.index} {...s} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-label="Decision trail">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Schema, policy, and approve trail
        </h2>
        {auditEvents.length === 0 ? (
          <p className="text-sm text-ink-muted">No audit events for this plan yet.</p>
        ) : (
          <ol className="relative space-y-0 border-l border-line pl-6">
            {auditEvents.map((ev, i) => {
              const meta = metaFor(ev.type);
              const summary = payloadSummary(ev.type, ev.payload);
              return (
                <li
                  key={ev._id}
                  className="relative pb-5 last:pb-0 motion-safe:animate-step-enter"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <span
                    className={`absolute -left-[31px] top-3 h-2.5 w-2.5 rounded-full border-2 ${toneDot(meta.tone)}`}
                    aria-hidden="true"
                  />
                  <article className="border border-line bg-surface px-4 py-3">
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
                      </div>
                      <time
                        className="shrink-0 text-right text-xs text-ink-muted"
                        dateTime={ev.createdAt}
                        title={new Date(ev.createdAt).toLocaleString()}
                      >
                        {relativeTime(ev.createdAt)}
                      </time>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
