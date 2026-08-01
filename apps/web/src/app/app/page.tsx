import { ButtonLink } from "@/components/Button";

export default function AppHome() {
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">Guardrail Agent</h1>
      <p className="mt-3 text-ink-muted">Compose wallet intents or review the audit trail.</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/app/compose">Compose intent</ButtonLink>
        <ButtonLink href="/app/audit" variant="secondary">
          Audit log
        </ButtonLink>
      </div>
    </div>
  );
}
