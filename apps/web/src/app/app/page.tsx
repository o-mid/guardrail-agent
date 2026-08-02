import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/Button";

export default function AppHome() {
  return (
    <div className="motion-safe:animate-mark-fade-in">
      <PageHeader
        title="Control plane"
        description="Compose a wallet intent, approve each policy-checked step, then verify the trail in Audit."
      />
      <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
        <div className="bg-surface p-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Primary</p>
          <h2 className="mt-2 font-display text-xl font-semibold text-ink">Compose</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Turn plain language into a plan. Review steps, approve, watch dry-run then execute.
          </p>
          <ButtonLink href="/app/compose" className="mt-5">
            Open Compose
          </ButtonLink>
        </div>
        <div className="bg-surface p-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Record</p>
          <h2 className="mt-2 font-display text-xl font-semibold text-ink">Audit</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Chronological decisions — accepts, rejects, and chain outcomes with filters.
          </p>
          <ButtonLink href="/app/audit" variant="secondary" className="mt-5">
            Open Audit
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
