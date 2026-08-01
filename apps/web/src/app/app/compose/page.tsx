"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/Button";
import { PolicyReject } from "@/components/PolicyReject";
import { StatusPill } from "@/components/StatusPill";
import { StepRow } from "@/components/StepRow";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

const CHIPS = [
  "Send 5 MOCK_USDC to Alice",
  "Swap 10 MOCK_USDC for MOCK_ETH",
  "Approve unlimited MOCK_USDC for 0xEvil",
  "Send 0.1 SOL to Bob",
  "Transfer 1000 MOCK_USDC to Alice",
];

type CreateResp = {
  intent: { _id: string; status: string };
  plan: {
    _id: string;
    status: string;
    summary: string;
    chain: string;
    rejectionReasons?: string[];
  } | null;
  steps: Array<{
    index: number;
    action: string;
    decodedSummary: string;
    status: string;
    payload: Record<string, unknown>;
  }>;
  validation: {
    ok: boolean;
    policyCodes: string[];
    humanMessages: string[];
    schemaErrors: string[];
  } | null;
};

export default function ComposePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateResp | null>(null);
  const [busyStep, setBusyStep] = useState<number | null>(null);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError(null);
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
    try {
      const data = await api<{ plan: CreateResp["plan"]; steps: CreateResp["steps"] }>(
        `/api/plans/${result.plan._id}/steps/${index}/approve`,
        { method: "POST", token, body: "{}" },
      );
      setResult((prev) => (prev ? { ...prev, plan: data.plan, steps: data.steps } : prev));
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
      const data = await api<{ plan: CreateResp["plan"]; steps: CreateResp["steps"] }>(
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

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink">Compose</h1>
        <p className="mt-1 text-sm text-ink-muted">Describe a wallet action in plain language.</p>
      </header>

      <section>
        <form onSubmit={submit} className="space-y-4">
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

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">Examples</p>
            <div className="flex flex-wrap gap-2">
              {CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setText(chip)}
                  className="border border-line bg-surface px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-accent hover:text-accent"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={loading || !text.trim()}>
            {loading ? "Planning…" : "Create plan"}
          </Button>
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
        <section className="mt-12 border border-line bg-surface">
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
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Plan review</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-ink">{result.plan.summary}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                  <span>{result.plan.chain}</span>
                  <StatusPill status={result.plan.status} />
                </div>
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

            <ul className="mt-6 space-y-2" aria-label="Plan steps">
              {result.steps.map((step) => (
                <StepRow
                  key={step.index}
                  index={step.index}
                  action={step.action}
                  decodedSummary={step.decodedSummary}
                  status={step.status}
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
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
