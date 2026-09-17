"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SearchIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyActions, EmptyDescription, EmptyIcon, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    return type.includes("succeed") || type.includes("completed") || type === "step.approved";
  }
  if (filter === "intent") return type.startsWith("intent.");
  if (filter === "step") return type.startsWith("step.");
  return true;
}

function badgeVariant(tone: Tone): "default" | "primary" | "destructive" | "warning" | "success" {
  if (tone === "danger") return "destructive";
  if (tone === "accent") return "success";
  if (tone === "warn") return "warning";
  return "default";
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
    return `${payload.chain}, ${payload.steps} step${payload.steps === 1 ? "" : "s"}`;
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
          <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      <section aria-label="Audit summary" className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        {[
          { label: "Events", value: counts.total },
          { label: "Rejects / fails", value: counts.rejects },
          { label: "Approvals / ok", value: counts.success },
          { label: "Step events", value: counts.steps },
        ].map((item) => (
          <div key={item.label} className="bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {loading ? "—" : item.value}
            </p>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="entity">Entity ID</Label>
          <Input
            id="entity"
            value={entityDraft}
            onChange={(e) => setEntityDraft(e.target.value)}
            placeholder="Filter by plan or intent id"
            spellCheck={false}
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Event type filter">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              type="button"
              size="sm"
              variant={filter === f.id ? "default" : "outline"}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-8">
        {loading ? (
          <div className="space-y-2" aria-label="Loading audit events">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <Empty className="rounded-lg border border-dashed border-border bg-card">
            <EmptyIcon>
              <SearchIcon className="size-5" />
            </EmptyIcon>
            <EmptyTitle>No matching events</EmptyTitle>
            <EmptyDescription>
              {events.length === 0
                ? "Create a plan from Compose to populate the log."
                : "Try another filter or clear the entity ID."}
            </EmptyDescription>
            <EmptyActions>
              <Button asChild size="sm">
                <Link href="/app/compose">Open Compose</Link>
              </Button>
            </EmptyActions>
          </Empty>
        ) : (
          <Table aria-label="Audit log">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium tracking-normal text-muted-foreground">
                  Event
                </TableHead>
                <TableHead className="text-xs font-medium tracking-normal text-muted-foreground">
                  Summary
                </TableHead>
                <TableHead className="text-xs font-medium tracking-normal text-muted-foreground">
                  Entity
                </TableHead>
                <TableHead className="text-right text-xs font-medium tracking-normal text-muted-foreground">
                  When
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ev) => {
                const meta = metaFor(ev.type);
                const open = !!expanded[ev._id];
                const summary = payloadSummary(ev.type, ev.payload);
                const hasPayload = !!ev.payload && Object.keys(ev.payload).length > 0;
                const planLink = ev.type.startsWith("plan.") || ev.type.startsWith("step.");
                return (
                  <TableRow key={ev._id}>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1">
                        <Badge variant={badgeVariant(meta.tone)}>{meta.label}</Badge>
                        <code className="font-mono text-[11px] text-muted-foreground">{ev.type}</code>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <p className="text-sm text-foreground">{summary ?? "No summary payload"}</p>
                      {hasPayload ? (
                        <button
                          type="button"
                          onClick={() => toggle(ev._id)}
                          className="mt-1 text-xs font-medium text-primary hover:underline"
                          aria-expanded={open}
                        >
                          {open ? "Hide details" : "Show details"}
                        </button>
                      ) : null}
                      {open && hasPayload ? (
                        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                          {Object.entries(ev.payload!).map(([key, value]) => {
                            const raw = formatValue(value);
                            const display =
                              key === "error" && typeof value === "string" ? shortenError(value) : raw;
                            return (
                              <div key={key} className={key === "error" ? "sm:col-span-2" : ""}>
                                <dt className="text-[11px] text-muted-foreground">{key}</dt>
                                <dd className="font-mono text-xs text-foreground break-all">{display}</dd>
                              </div>
                            );
                          })}
                        </dl>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs" title={ev.entityId}>
                          {ev.entityId}
                        </span>
                        {planLink ? (
                          <Link
                            href={`/app/plans/${ev.entityId}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Open evidence
                          </Link>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <time dateTime={ev.createdAt} title={new Date(ev.createdAt).toLocaleString()}>
                        <span className="block text-sm text-foreground">{relativeTime(ev.createdAt)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {new Date(ev.createdAt).toLocaleString()}
                        </span>
                      </time>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
