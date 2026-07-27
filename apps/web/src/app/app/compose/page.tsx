"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
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
  plan: { _id: string; status: string; summary: string; chain: string; rejectionReasons?: string[] } | null;
  steps: Array<{ index: number; action: string; decodedSummary: string; status: string; payload: Record<string, unknown> }>;
  validation: { ok: boolean; policyCodes: string[]; humanMessages: string[]; schemaErrors: string[] } | null;
};

export default function ComposePage() {
  const router = useRouter();
  const [text, setText] = useState(CHIPS[0]);
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

  async function reject() {
    if (!result?.plan) return;
    const token = getAccessToken();
    if (!token) return;
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
    (result.plan.status === "rejected_policy" || result.plan.status === "rejected_schema");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl">Compose</h1>
        <Link href="/app" className="text-sm underline">
          Back
        </Link>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block text-sm">
          Intent
          <textarea
            className="mt-1 w-full border border-line bg-paper/80 px-3 py-2"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className="border border-line bg-paper/60 px-2 py-1 text-xs hover:bg-paper"
              onClick={() => setText(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Planning…" : "Create plan"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      {result?.plan ? (
        <section className="mt-10 border border-line bg-paper/50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink/50">Plan review</p>
              <h2 className="mt-1 font-display text-2xl">{result.plan.summary}</h2>
              <p className="mt-1 text-sm text-ink/70">
                {result.plan.chain} · {result.plan.status}
              </p>
            </div>
            {result.plan.status === "awaiting_approval" || result.plan.status === "executing" ? (
              <button type="button" onClick={reject} className="border border-danger px-3 py-1.5 text-sm text-danger">
                Reject plan
              </button>
            ) : null}
          </div>

          {rejected ? (
            <div className="mt-4 border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              <p className="font-medium">Rejected</p>
              <p className="mt-1">{(result.validation?.policyCodes ?? result.plan.rejectionReasons ?? []).join(", ")}</p>
              <ul className="mt-2 list-disc pl-5">
                {(result.validation?.humanMessages ?? []).map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <ul className="mt-5 space-y-3">
            {result.steps.map((step) => (
              <li key={step.index} className="border border-line/80 bg-white/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      #{step.index} {step.action}
                    </p>
                    <p className="text-sm text-ink/70">{step.decodedSummary}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-ink/50">{step.status}</p>
                  </div>
                  {step.status === "pending" && result.plan?.status === "awaiting_approval" ? (
                    <button
                      type="button"
                      disabled={busyStep === step.index}
                      onClick={() => approve(step.index)}
                      className="bg-ink px-3 py-1.5 text-sm text-paper disabled:opacity-60"
                    >
                      {busyStep === step.index ? "Working…" : "Approve"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {result.plan._id ? (
            <p className="mt-4 text-xs text-ink/50">
              Live updates: <Link className="underline" href={`/app/plans/${result.plan._id}`}>open execution feed</Link>
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
