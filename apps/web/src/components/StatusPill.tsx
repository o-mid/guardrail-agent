type Status =
  | "pending"
  | "approved"
  | "succeeded"
  | "failed"
  | "rejected"
  | "rejected_policy"
  | "rejected_schema"
  | "awaiting_approval"
  | "executing"
  | "dry_running"
  | "submitting"
  | "cancelled"
  | "completed"
  | string;

const styles: Record<string, string> = {
  pending: "bg-canvas-subtle text-ink-muted border-line",
  approved: "bg-accent/10 text-accent border-accent/30",
  awaiting_approval: "bg-canvas-subtle text-ink border-line motion-safe:animate-status-pulse",
  executing: "bg-accent/10 text-accent border-accent/30 motion-safe:animate-status-pulse",
  dry_running: "bg-accent/10 text-accent border-accent/30 motion-safe:animate-status-pulse",
  submitting: "bg-accent/15 text-accent border-accent/40 motion-safe:animate-status-pulse",
  succeeded: "bg-accent/10 text-accent border-accent/30",
  completed: "bg-accent/10 text-accent border-accent/30",
  failed: "bg-danger-bg text-danger border-danger/40",
  cancelled: "bg-canvas-subtle text-ink-muted border-line",
  rejected: "bg-danger-bg text-danger border-danger/40",
  rejected_policy: "bg-danger-bg text-danger border-danger/40",
  rejected_schema: "bg-danger-bg text-danger border-danger/40",
};

function label(status: Status): string {
  return status.replace(/_/g, " ");
}

export function StatusPill({ status }: { status: Status }) {
  const style = styles[status] ?? styles.pending;
  const text = label(status);
  return (
    <span
      aria-label={`Status: ${text}`}
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium uppercase tracking-wide transition-colors duration-300 ${style}`}
    >
      {text}
    </span>
  );
}
