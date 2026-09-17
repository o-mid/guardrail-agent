import { Badge } from "@/components/ui/badge";

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

function variantFor(status: string): "default" | "primary" | "warning" | "success" | "destructive" | "secondary" {
  if (
    status === "rejected" ||
    status === "rejected_policy" ||
    status === "rejected_schema" ||
    status === "failed"
  ) {
    return "destructive";
  }
  if (status === "awaiting_approval" || status === "pending") return "warning";
  if (
    status === "approved" ||
    status === "succeeded" ||
    status === "completed" ||
    status === "executing" ||
    status === "dry_running" ||
    status === "submitting"
  ) {
    return status === "succeeded" || status === "completed" || status === "approved"
      ? "success"
      : "primary";
  }
  return "secondary";
}

function label(status: Status): string {
  return status.replace(/_/g, " ");
}

export function StatusPill({ status }: { status: Status }) {
  const text = label(status);
  const live =
    status === "awaiting_approval" ||
    status === "executing" ||
    status === "dry_running" ||
    status === "submitting";
  return (
    <Badge
      variant={variantFor(status)}
      aria-label={`Status: ${text}`}
      className={live ? "motion-safe:animate-status-pulse" : undefined}
    >
      {text}
    </Badge>
  );
}
