import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { ArrowRightIcon, WarningIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const PIPELINE = [
  { n: "01", title: "Intent", body: "Natural-language wallet action" },
  { n: "02", title: "PlanV1", body: "Typed JSON from the planner" },
  { n: "03", title: "Go policy", body: "Schema, caps, allowlists; re-check on approve" },
  { n: "04", title: "HITL", body: "Approve each step, or stop" },
  { n: "05", title: "Vault sign", body: "Keys stay in the demo vault" },
  { n: "06", title: "Local chain", body: "Anvil or solana-local only" },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen px-4 py-8 sm:px-8 sm:py-12">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section id="main-content" className="motion-safe:animate-mark-fade-in">
          <div className="flex items-center gap-2.5">
            <BrandMark size="md" />
            <p className="text-sm font-medium text-muted-foreground">Guardrail Agent</p>
          </div>
          <h1 className="mt-8 max-w-[16ch] text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Control plane for untrusted chain intents
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
            Typed PlanV1, Go policy, then you approve. A vault signs for local Anvil or Solana.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild>
              <Link href="/login">
                Open the console
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
            <Link href="/register" className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-foreground">
              Register
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Honest limits">
            <li>
              <Badge variant="secondary">No mainnet</Badge>
            </li>
            <li>
              <Badge variant="secondary">PLANNER=mock</Badge>
            </li>
            <li>
              <Badge variant="secondary">OpenAI fail-closed</Badge>
            </li>
            <li>
              <Badge variant="secondary">No production wallets</Badge>
            </li>
          </ul>
        </section>

        <aside className="rounded-lg border border-border bg-card p-5 [box-shadow:var(--shadow-md)] sm:p-6">
          <ol className="space-y-3">
            {PIPELINE.map((step) => (
              <li key={step.n} className="grid grid-cols-[2.5rem_1fr] items-start gap-3">
                <span className="font-mono text-xs text-primary">{step.n}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <Separator className="my-5" />
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <WarningIcon className="size-4 text-destructive" />
              Rejects are the product
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="destructive">infinite_approve</Badge>
              <Badge variant="destructive">recipient_not_allowed</Badge>
              <Badge variant="outline">schema junk</Badge>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
