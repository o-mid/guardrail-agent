const STAGES = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "dry_running", label: "Dry-run" },
  { id: "submitting", label: "Submit" },
  { id: "succeeded", label: "Done" },
] as const;

function stageIndex(status: string): number {
  const i = STAGES.findIndex((s) => s.id === status);
  if (i >= 0) return i;
  return 0;
}

function isTerminalFail(status: string): boolean {
  return status === "failed" || status === "cancelled" || status === "rejected";
}

export function StepPipeline({ status }: { status: string }) {
  const failed = isTerminalFail(status);
  const current = failed ? -1 : stageIndex(status);

  return (
    <ol
      aria-label={`Execution pipeline: ${status.replace(/_/g, " ")}`}
      className="mt-3 flex flex-wrap items-center gap-1.5"
    >
      {STAGES.map((stage, i) => {
        const done = !failed && current > i;
        const active = !failed && current === i;
        return (
          <li key={stage.id} className="flex items-center gap-1.5">
            {i > 0 ? (
              <span
                aria-hidden
                className={`h-px w-4 transition-colors duration-300 ${
                  done || active ? "bg-accent" : "bg-line"
                }`}
              />
            ) : null}
            <span
              className={[
                "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide transition-all duration-300",
                done
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : active
                    ? "border-accent bg-accent text-white motion-safe:animate-stage-active"
                    : "border-line bg-canvas-subtle text-ink-muted",
              ].join(" ")}
            >
              <span
                aria-hidden
                className={[
                  "inline-block h-1.5 w-1.5 rounded-full transition-transform duration-300",
                  done ? "scale-100 bg-accent" : "",
                  active ? "scale-125 bg-white" : "",
                  !done && !active ? "bg-ink-muted/40" : "",
                ].join(" ")}
              />
              {stage.label}
            </span>
          </li>
        );
      })}
      {failed ? (
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-px w-4 bg-danger/50" />
          <span className="inline-flex items-center border border-danger/40 bg-danger-bg px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-danger motion-safe:animate-reject-enter">
            {status.replace(/_/g, " ")}
          </span>
        </li>
      ) : null}
    </ol>
  );
}
