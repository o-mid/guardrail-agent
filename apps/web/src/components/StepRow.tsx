import { Button } from "./Button";
import { StatusPill } from "./StatusPill";

type StepRowProps = {
  index: number;
  action: string;
  decodedSummary: string;
  status: string;
  canApprove?: boolean;
  busy?: boolean;
  onApprove?: () => void;
};

export function StepRow({
  index,
  action,
  decodedSummary,
  status,
  canApprove,
  busy,
  onApprove,
}: StepRowProps) {
  return (
    <li className="border border-line bg-surface px-4 py-3 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-ink-muted">#{index}</span>
            <span className="text-sm font-medium">{action}</span>
            <StatusPill status={status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">{decodedSummary}</p>
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
    </li>
  );
}
