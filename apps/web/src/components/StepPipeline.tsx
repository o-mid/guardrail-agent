import { Badge } from "@/components/ui/badge";

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
                className={`h-px w-4 ${done || active ? "bg-primary" : "bg-border"}`}
              />
            ) : null}
            <Badge
              variant={done ? "success" : active ? "primary" : "outline"}
              className={active ? "motion-safe:animate-stage-active" : undefined}
            >
              {stage.label}
            </Badge>
          </li>
        );
      })}
      {failed ? (
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-px w-4 bg-destructive/50" />
          <Badge variant="destructive" className="motion-safe:animate-reject-enter">
            {status.replace(/_/g, " ")}
          </Badge>
        </li>
      ) : null}
    </ol>
  );
}
