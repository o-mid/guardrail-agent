import { ButtonLink } from "@/components/Button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-3xl motion-safe:animate-mark-fade-in">
        <div className="mb-6 flex h-10 w-10 items-center justify-center border-2 border-accent bg-surface">
          <span className="font-display text-sm font-bold text-accent" aria-hidden="true">
            G
          </span>
        </div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-ink md:text-6xl">
          Guardrail Agent
        </h1>
        <p className="mt-4 max-w-lg text-lg text-ink-muted">
          Natural language in. Policy-checked plan out. Nothing moves without your approval.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/login">Log in</ButtonLink>
          <ButtonLink href="/register" variant="secondary">
            Register
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
