import { BrandMark } from "@/components/BrandMark";
import { ButtonLink } from "@/components/Button";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col justify-center overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(10,158,143,0.06)_70%,transparent_100%)]"
      />
      <div className="relative mx-auto w-full max-w-3xl motion-safe:animate-mark-fade-in">
        <BrandMark size="lg" />
        <h1 className="mt-7 font-display text-5xl font-semibold tracking-tight text-ink md:text-6xl">
          Guardrail Agent
        </h1>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-muted">
          Natural language in. Policy-checked plan out. Nothing moves without your approval.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <ButtonLink href="/login">Log in</ButtonLink>
          <ButtonLink href="/register" variant="secondary">
            Register
          </ButtonLink>
        </div>
        <p className="mt-10 max-w-sm text-xs leading-relaxed text-ink-muted">
          Local demo stack — Anvil + optional Solana validator. Use the Guide (bottom right) for the
          walkthrough.
        </p>
      </div>
    </main>
  );
}
