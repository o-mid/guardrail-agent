"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useState } from "react";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { PolicyReject } from "@/components/PolicyReject";
import { StatusPill } from "@/components/StatusPill";
import { StepRow, type StepDetail } from "@/components/StepRow";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { usePlanStream } from "@/lib/usePlanStream";

type Plan = {
  _id: string;
  status: string;
  summary: string;
  chain: string;
  policyVersion?: number;
  schemaVersion?: string;
  rejectionReasons?: string[];
};

type CreateResp = {
  intent: { _id: string; status: string; text?: string };
  plan: Plan | null;
  steps: StepDetail[];
  validation: {
    ok: boolean;
    policyCodes: string[];
    humanMessages: string[];
    schemaErrors: string[];
  } | null;
};

function Ex({
  text,
  onPick,
}: {
  text: string;
  onPick: (text: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(text)}
      aria-label={`Use example: ${text}`}
      className="mx-0.5 inline border-b border-accent/40 font-medium text-accent transition-colors hover:border-accent hover:bg-accent/5"
    >
      {text}
    </button>
  );
}

export default function ComposePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateResp | null>(null);
  const [busyStep, setBusyStep] = useState<number | null>(null);
  const [liveHint, setLiveHint] = useState<string | null>(null);
  const [lastIntent, setLastIntent] = useState("");

  const onStream = useCallback((bundle: { plan: Plan; steps: StepDetail[] }, raw: string) => {
    setResult((prev) =>
      prev
        ? {
            ...prev,
            plan: { ...prev.plan!, ...bundle.plan },
            steps: bundle.steps,
          }
        : prev,
    );
    try {
      const parsed = JSON.parse(raw) as { type?: string; status?: string; index?: number };
      const bits = [parsed.type, parsed.status, parsed.index !== undefined ? `#${parsed.index}` : null]
        .filter(Boolean)
        .join(" · ");
      if (bits) setLiveHint(bits);
    } catch {
      // ignore
    }
  }, []);

  usePlanStream(result?.plan?._id, onStream);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError(null);
    setLiveHint(null);
    setLastIntent(text.trim());
    try {
      const data = await api<CreateResp>("/api/intents", {
        method: "POST",
        token,
        body: JSON.stringify({ text }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setLoading(false);
    }
  }

  async function approve(index: number) {
    if (!result?.plan) return;
    const token = getAccessToken();
    if (!token) return;
    setBusyStep(index);
    setError(null);
    setLiveHint(`approving · #${index}`);
    try {
      const data = await api<{ plan: Plan; steps: StepDetail[] }>(
        `/api/plans/${result.plan._id}/steps/${index}/approve`,
        { method: "POST", token, body: "{}" },
      );
      setResult((prev) => (prev ? { ...prev, plan: data.plan, steps: data.steps } : prev));
      setLiveHint(`step #${index} finished`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "approve_failed");
    } finally {
      setBusyStep(null);
    }
  }

  async function rejectPlan() {
    if (!result?.plan) return;
    const token = getAccessToken();
    if (!token) return;
    setError(null);
    try {
      const data = await api<{ plan: Plan; steps: StepDetail[] }>(
        `/api/plans/${result.plan._id}/reject`,
        { method: "POST", token, body: "{}" },
      );
      setResult((prev) => (prev ? { ...prev, plan: data.plan, steps: data.steps } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "reject_failed");
    }
  }

  const rejected =
    result?.plan &&
    (result.plan.status === "rejected_policy" ||
      result.plan.status === "rejected_schema" ||
      result.plan.status === "rejected");

  const canReject =
    result?.plan &&
    (result.plan.status === "awaiting_approval" || result.plan.status === "executing");

  const intentText = result?.intent?.text || lastIntent;

  return (
    <div>
      <PageHeader
        title="Compose"
        description="Natural language in. Schema-checked plan, Go policy gate, then you approve each step before Anvil or Solana."
      />

      <section
        aria-label="How compose works"
        className="mb-8 grid gap-px border border-line bg-line sm:grid-cols-4"
      >
        {[
          { n: "1", t: "Intent", d: "Plain-language wallet action" },
          { n: "2", t: "Plan JSON", d: "MockPlanner → typed steps" },
          { n: "3", t: "Policy", d: "Schema + caps + allowlists" },
          { n: "4", t: "HITL", d: "You approve; then dry-run + send" },
        ].map((s) => (
          <div key={s.n} className="bg-surface px-4 py-3">
            <p className="font-mono text-[11px] text-ink-muted">{s.n}</p>
            <p className="mt-0.5 text-sm font-medium text-ink">{s.t}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{s.d}</p>
          </div>
        ))}
      </section>

      <section>
        <form onSubmit={submit} className="space-y-5">
          <label className="block text-sm font-medium text-ink">
            Intent
            <textarea
              className="mt-1.5 w-full resize-y border border-line bg-surface px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Send 5 MOCK_USDC to Alice"
            />
          </label>

          <div className="atmosphere-panel px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Examples</p>
            <p className="mt-1 text-xs text-ink-muted">
              Click an underlined sentence to drop it into the intent box.
            </p>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-muted">
              <p>
                Start with a simple allowlisted transfer:{" "}
                <Ex text="Send 5 MOCK_USDC to Alice" onPick={setText} />. If you want a larger
                amount that still clears the policy cap, try{" "}
                <Ex text="Send 25 MOCK_USDC to Alice" onPick={setText} />.
              </p>
              <p>
                To exercise the Anvil router path, ask to{" "}
                <Ex text="Swap 10 MOCK_USDC for MOCK_ETH" onPick={setText} />, or keep it small with{" "}
                <Ex text="Swap 2 MOCK_USDC for MOCK_ETH" onPick={setText} />. A finite spend limit
                looks like <Ex text="Approve 50 MOCK_USDC for the router" onPick={setText} />.
              </p>
              <p>
                On the Solana side, you can{" "}
                <Ex text="Send 0.1 SOL to Bob" onPick={setText} /> — or half of that with{" "}
                <Ex text="Send 0.05 SOL to Bob" onPick={setText} />.
              </p>
              <p>
                For the reject demo, force an infinite approve:{" "}
                <Ex text="Approve unlimited MOCK_USDC for 0xEvil" onPick={setText} />. Over-cap
                transfers fail the same way —{" "}
                <Ex text="Transfer 1000 MOCK_USDC to Alice" onPick={setText} /> — and so does a
                transfer to a non-allowlisted address like{" "}
                <Ex text="Send 5 MOCK_USDC to 0xEvil" onPick={setText} />.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={loading || !text.trim()}>
              {loading ? "Planning…" : "Create plan"}
            </Button>
            {text.trim() ? (
              <button
                type="button"
                onClick={() => setText("")}
                className="text-sm text-ink-muted hover:text-ink"
              >
                Clear
              </button>
            ) : null}
          </div>
        </form>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-sm border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}
      </section>

      {result?.plan ? (
        <section className="mt-12 border border-line bg-surface motion-safe:animate-mark-fade-in">
          <p aria-live="polite" aria-atomic="true" className="sr-only">
            Plan status: {result.plan.status.replace(/_/g, " ")}
          </p>
          {rejected ? (
            <PolicyReject
              policyCodes={
                result.validation?.policyCodes.length
                  ? result.validation.policyCodes
                  : (result.plan.rejectionReasons ?? [])
              }
              humanMessages={result.validation?.humanMessages ?? []}
              schemaErrors={result.validation?.schemaErrors ?? []}
            />
          ) : null}

          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Plan review</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-ink">{result.plan.summary}</h2>
                {intentText ? (
                  <p className="mt-2 text-sm text-ink-muted">
                    From intent: <span className="text-ink">&ldquo;{intentText}&rdquo;</span>
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                  <span className="border border-line bg-canvas-subtle px-2 py-0.5 font-mono text-xs">
                    {result.plan.chain}
                  </span>
                  <StatusPill status={result.plan.status} />
                  {result.plan.policyVersion != null ? (
                    <span className="font-mono text-xs">policy v{result.plan.policyVersion}</span>
                  ) : null}
                  {result.plan.schemaVersion ? (
                    <span className="font-mono text-xs">schema {result.plan.schemaVersion}</span>
                  ) : null}
                  <span className="font-mono text-xs">
                    {result.steps.length} step{result.steps.length === 1 ? "" : "s"}
                  </span>
                </div>
                {liveHint ? (
                  <p className="mt-2 font-mono text-xs text-accent motion-safe:animate-status-pulse">
                    live · {liveHint}
                  </p>
                ) : null}
              </div>
              {canReject ? (
                <Button
                  variant="danger"
                  onClick={rejectPlan}
                  aria-label="Reject entire plan"
                  className="shrink-0"
                >
                  Reject plan
                </Button>
              ) : null}
            </div>

            <dl className="mt-6 grid gap-3 border border-line bg-canvas-subtle p-4 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-medium uppercase tracking-wide text-ink-muted">Intent id</dt>
                <dd className="mt-0.5 break-all font-mono text-ink">{result.intent._id}</dd>
              </div>
              <div>
                <dt className="font-medium uppercase tracking-wide text-ink-muted">Plan id</dt>
                <dd className="mt-0.5 break-all font-mono text-ink">{result.plan._id}</dd>
              </div>
              <div>
                <dt className="font-medium uppercase tracking-wide text-ink-muted">Intent status</dt>
                <dd className="mt-0.5 font-mono text-ink">{result.intent.status}</dd>
              </div>
              <div>
                <dt className="font-medium uppercase tracking-wide text-ink-muted">Validation</dt>
                <dd className="mt-0.5 font-mono text-ink">
                  {result.validation
                    ? result.validation.ok
                      ? "ok"
                      : `blocked · ${(result.validation.policyCodes || []).join(", ") || "see reject"}`
                    : "—"}
                </dd>
              </div>
            </dl>

            {!rejected ? (
              <p className="mt-4 text-sm text-ink-muted">
                Review each step&apos;s decoded fields and pipeline. Approve runs dry-run then broadcast on{" "}
                <span className="font-mono text-ink">{result.plan.chain}</span>. Nothing moves until you
                click Approve.
              </p>
            ) : null}

            <ul className="mt-6 space-y-2" aria-label="Plan steps">
              {result.steps.map((step) => (
                <StepRow
                  key={step.index}
                  {...step}
                  canApprove={
                    step.status === "pending" && result.plan?.status === "awaiting_approval"
                  }
                  busy={busyStep === step.index}
                  onApprove={() => approve(step.index)}
                />
              ))}
            </ul>

            {result.plan._id ? (
              <p className="mt-6 text-sm text-ink-muted">
                Watch execution:{" "}
                <Link
                  href={`/app/plans/${result.plan._id}`}
                  className="font-medium text-accent hover:underline"
                >
                  open execution feed
                </Link>
                {" · "}
                <Link
                  href="/app/audit"
                  className="font-medium text-accent hover:underline"
                >
                  audit timeline
                </Link>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
