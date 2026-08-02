"use client";

import { useEffect, useState } from "react";
import { Button } from "./Button";
import { StatusPill } from "./StatusPill";
import { StepPipeline } from "./StepPipeline";

export type StepDetail = {
  index: number;
  action: string;
  decodedSummary: string;
  status: string;
  payload?: Record<string, unknown>;
  dryRunOk?: boolean | null;
  txHash?: string | null;
  error?: string | null;
};

type StepRowProps = StepDetail & {
  canApprove?: boolean;
  busy?: boolean;
  onApprove?: () => void;
};

const HIDDEN_PAYLOAD_KEYS = new Set(["action"]);

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") {
    if (value.length > 66 && value.startsWith("0x")) {
      return `${value.slice(0, 10)}…${value.slice(-8)}`;
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function payloadEntries(payload?: Record<string, unknown>): Array<[string, string]> {
  if (!payload) return [];
  return Object.entries(payload)
    .filter(([k]) => !HIDDEN_PAYLOAD_KEYS.has(k))
    .map(([k, v]) => [k, formatValue(v)]);
}

export function StepRow({
  index,
  action,
  decodedSummary,
  status,
  payload,
  dryRunOk,
  txHash,
  error,
  canApprove,
  busy,
  onApprove,
}: StepRowProps) {
  const [flash, setFlash] = useState(false);
  const [prevStatus, setPrevStatus] = useState(status);

  useEffect(() => {
    if (status !== prevStatus) {
      setPrevStatus(status);
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 450);
      return () => window.clearTimeout(t);
    }
  }, [status, prevStatus]);

  const fields = payloadEntries(payload);

  return (
    <li
      className={[
        "border border-line bg-surface px-4 py-3 transition-colors duration-300",
        "motion-safe:animate-step-enter",
        flash ? "motion-safe:animate-status-flash border-accent/50" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-ink-muted">#{index}</span>
            <span className="text-sm font-medium">{action}</span>
            <StatusPill status={status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">{decodedSummary}</p>
          <StepPipeline status={status} />
        </div>
        {canApprove && onApprove ? (
          <Button
            variant="primary"
            onClick={onApprove}
            disabled={busy}
            aria-label={`Approve step ${index}: ${action}`}
            className="shrink-0"
          >
            {busy ? "Working…" : "Approve"}
          </Button>
        ) : null}
      </div>

      {fields.length > 0 ? (
        <dl className="mt-3 grid gap-x-4 gap-y-1 border-t border-line pt-3 sm:grid-cols-2">
          {fields.map(([key, value]) => (
            <div key={key} className="flex min-w-0 gap-2 text-xs">
              <dt className="shrink-0 font-medium uppercase tracking-wide text-ink-muted">{key}</dt>
              <dd className="min-w-0 truncate font-mono text-ink" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        {dryRunOk === true ? <span className="text-accent">dry-run ok</span> : null}
        {dryRunOk === false ? <span className="text-danger">dry-run failed</span> : null}
        {txHash ? (
          <span className="font-mono">
            tx <span className="text-ink">{txHash}</span>
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}
