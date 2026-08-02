"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";

const STORAGE_KEY = "ga-guide-v2";

type GuideStep = {
  id: string;
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
};

const STEPS: GuideStep[] = [
  {
    id: "welcome",
    title: "Operator briefing",
    body: "Guardrail turns natural language into a schema-checked plan. Policy decides; you approve. Local Anvil / Solana only.",
    href: "/",
    hrefLabel: "Home",
  },
  {
    id: "login",
    title: "Authenticate",
    body: "Sign in with demo@guardrail.local / demopass123, or use Anvil demo account. Wallet SIWE is optional.",
    href: "/login",
    hrefLabel: "Login",
  },
  {
    id: "compose",
    title: "Compose",
    body: "Describe a wallet action. Click an underlined example sentence to fill the intent field.",
    href: "/app/compose",
    hrefLabel: "Compose",
  },
  {
    id: "accept",
    title: "Accept path",
    body: "Run “Send 5 MOCK_USDC to Alice”. Policy should pass. Review decoded fields and the step pipeline.",
    href: "/app/compose",
    hrefLabel: "Compose",
  },
  {
    id: "approve",
    title: "Human approve",
    body: "Approve step #0. Watch pending → dry-run → submit → succeeded. Nothing broadcasts until you click.",
    href: "/app/compose",
    hrefLabel: "Compose",
  },
  {
    id: "reject",
    title: "Reject path",
    body: "Try “Approve unlimited MOCK_USDC for 0xEvil”. Infinite approve is blocked — loud reject, no chain write.",
    href: "/app/compose",
    hrefLabel: "Compose",
  },
  {
    id: "audit",
    title: "Audit",
    body: "Open Audit for the decision log. Filter rejects, open a plan feed, confirm every gate left a trail.",
    href: "/app/audit",
    hrefLabel: "Audit",
  },
  {
    id: "done",
    title: "Loop complete",
    body: "Intent → schema → Go policy → your approve → local chain. Re-open this panel anytime from Guide.",
  },
];

type Persisted = {
  open: boolean;
  step: number;
  dismissed: boolean;
};

function loadState(): Persisted {
  if (typeof window === "undefined") {
    return { open: false, step: 0, dismissed: false };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { open: true, step: 0, dismissed: false };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      open: Boolean(parsed.open),
      step: Math.min(Math.max(Number(parsed.step) || 0, 0), STEPS.length - 1),
      dismissed: Boolean(parsed.dismissed),
    };
  } catch {
    return { open: true, step: 0, dismissed: false };
  }
}

function saveState(state: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function pathMatches(href: string | undefined, pathname: string): boolean {
  if (!href) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GuideBot() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const s = loadState();
    setOpen(s.open && !s.dismissed);
    setStep(s.step);
    setDismissed(s.dismissed);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveState({ open, step, dismissed });
  }, [ready, open, step, dismissed]);

  if (!ready) return null;

  if (dismissed) {
    return (
      <div className="fixed bottom-5 right-5 z-50">
        <button
          type="button"
          onClick={() => {
            setDismissed(false);
            setOpen(true);
          }}
          className="group flex items-center gap-2 border border-line bg-surface px-3 py-2.5 text-sm font-medium text-ink shadow-[var(--guide-shadow)] transition-colors hover:border-accent"
          aria-label="Open guide"
        >
          <BrandMark size="sm" />
          <span>Guide</span>
        </button>
      </div>
    );
  }

  const current = STEPS[step];
  const isLast = step >= STEPS.length - 1;
  const here = pathMatches(current.href, pathname);

  function next() {
    if (isLast) {
      setOpen(false);
      setDismissed(true);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function skipAll() {
    setOpen(false);
    setDismissed(true);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2">
      {open ? (
        <div
          id="guide-panel"
          role="dialog"
          aria-label="Product guide"
          className="motion-safe:animate-mark-fade-in w-[min(100vw-1.5rem,23.5rem)] overflow-hidden border border-line bg-surface shadow-[var(--guide-shadow)]"
        >
          <div className="h-0.5 bg-accent" aria-hidden />

          <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-3.5">
            <div className="flex items-start gap-2.5">
              <BrandMark size="sm" className="mt-0.5" />
              <div>
                <p className="font-display text-sm font-semibold tracking-tight text-ink">
                  Operator guide
                </p>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  Step {step + 1} of {STEPS.length}
                  {here ? " · this screen" : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-ink-muted transition-colors hover:text-ink"
              aria-label="Minimize guide"
            >
              Minimize
            </button>
          </header>

          <div className="px-4">
            <div
              className="h-1 overflow-hidden bg-canvas-subtle"
              role="progressbar"
              aria-valuenow={step + 1}
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
            >
              <div
                className="h-full bg-accent transition-[width] duration-300 ease-out"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="max-h-[min(52vh,20rem)] space-y-3 overflow-y-auto px-4 py-4">
            <div
              key={current.id}
              className="border border-line bg-canvas-subtle px-3.5 py-3 motion-safe:animate-step-enter"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-accent">
                {current.title}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">{current.body}</p>
              {current.href ? (
                <Link
                  href={current.href}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  {current.hrefLabel ?? "Open"}
                  <span aria-hidden>→</span>
                </Link>
              ) : null}
            </div>

            <ol className="grid grid-cols-4 gap-1 sm:grid-cols-8" aria-label="Guide steps">
              {STEPS.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setStep(i)}
                    title={s.title}
                    className={`flex h-7 w-full items-center justify-center border text-[10px] font-medium transition-colors ${
                      i === step
                        ? "border-accent bg-accent text-white"
                        : i < step
                          ? "border-accent/30 bg-accent/10 text-accent"
                          : "border-line bg-surface text-ink-muted hover:border-accent/50"
                    }`}
                    aria-label={`Step ${i + 1}: ${s.title}`}
                    aria-current={i === step ? "step" : undefined}
                  >
                    {i + 1}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-canvas-subtle/60 px-4 py-3">
            <button
              type="button"
              onClick={skipAll}
              className="text-xs text-ink-muted transition-colors hover:text-ink"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
                >
                  Back
                </button>
              ) : null}
              {!isLast ? (
                <button
                  type="button"
                  onClick={next}
                  className="border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
                >
                  Skip
                </button>
              ) : null}
              <button
                type="button"
                onClick={next}
                className="border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
              >
                {isLast ? "Finish" : "Next"}
              </button>
            </div>
          </footer>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 border border-line bg-surface px-3 py-2.5 text-sm font-medium text-ink shadow-[var(--guide-shadow)] transition-colors hover:border-accent"
        aria-expanded={open}
        aria-controls="guide-panel"
        aria-label={open ? "Close guide" : "Open guide"}
      >
        <BrandMark size="sm" />
        <span>{open ? "Hide guide" : "Guide"}</span>
        {!open ? (
          <span className="border border-line bg-canvas-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
            {step + 1}/{STEPS.length}
          </span>
        ) : null}
      </button>
    </div>
  );
}
