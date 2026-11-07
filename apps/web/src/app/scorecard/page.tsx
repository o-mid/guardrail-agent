import Link from "next/link";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scorecard · Guardrail Agent",
  description: "Firewall contract and mock-planner results. A live model run has not been executed.",
};

type FirewallRow = {
  id: string;
  class: string;
  firewallHeld: boolean;
  policyCodes: string[];
};

type Firewall = {
  date: string;
  commit: string;
  cases: number;
  passed: number;
  failed: number;
  liveModel: string;
  results: FirewallRow[];
};

type MockSummary = {
  date: string;
  commit: string;
  repeats: number;
  cases: number;
  runs: number;
  failed: number;
  spentUsd: number;
  model: string;
};

type Trace = {
  id: string;
  verdict: { modelResisted: boolean; firewallHeld: boolean };
  latencyMs: number;
  tokens: { promptTokens: number; completionTokens: number } | null;
  costUsd: number;
};

function readJson<T>(rel: string): T {
  const file = path.join(process.cwd(), "../../packages/evals/scorecard", rel);
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

export default function ScorecardPage() {
  const firewall = readJson<Firewall>("firewall.json");
  const mock = readJson<MockSummary>("mock-traces/summary.json");
  const traces = firewall.results.map((row) => readJson<Trace>(`mock-traces/${row.id}-0.json`));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <p className="text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Guardrail Agent
        </Link>
        <span className="px-2">/</span>
        <Link href="/break-it" className="hover:text-foreground">
          Break a payment
        </Link>
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Scorecard</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Two separate scores. Model resisted means the planner’s plan still matched invoice 1042. Firewall held means policy allowed that match, or blocked a plan that drifted, including a repeat of an invoice that was already paid. A pass here is not evidence the system is safe.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Firewall contract</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {firewall.passed} of {firewall.cases} stored plans matched the case file. Failed: {firewall.failed}. Run at {firewall.date}. Commit {firewall.commit}. No planner on this path. The live model suite has not been executed ({firewall.liveModel}).
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Case</th>
                <th className="px-3 py-2 font-medium">Firewall</th>
                <th className="px-3 py-2 font-medium">Policy codes</th>
              </tr>
            </thead>
            <tbody>
              {firewall.results.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
                  <td className="px-3 py-2">{row.firewallHeld ? "held" : "miss"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.policyCodes.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Mock planner</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {mock.runs} runs, {mock.repeats} repeat, {mock.failed} failed. Model {mock.model}. Spent {mock.spentUsd} USD. Run at {mock.date}. Commit {mock.commit}. Tokens are null because the mock router does not call a model. Traces are in the repo at packages/evals/scorecard/mock-traces/.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Case</th>
                <th className="px-3 py-2 font-medium">Model resisted</th>
                <th className="px-3 py-2 font-medium">Firewall held</th>
                <th className="px-3 py-2 font-medium">Latency</th>
                <th className="px-3 py-2 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {traces.map((trace) => (
                <tr key={trace.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{trace.id}</td>
                  <td className="px-3 py-2">{trace.verdict.modelResisted ? "yes" : "no"}</td>
                  <td className="px-3 py-2">{trace.verdict.firewallHeld ? "yes" : "no"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{trace.latencyMs} ms</td>
                  <td className="px-3 py-2 font-mono text-xs">{trace.costUsd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        <h2 className="text-lg font-medium text-foreground">Limits of this page</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>The live model suite has not been executed. No Anthropic or OpenAI numbers are on this page.</li>
          <li>The mock router is a keyword match. It is here so the two scores have a deterministic trace, not as a stand-in for a model.</li>
          <li>The spend window, paid invoices, and visitor totals live in API memory and reset on restart.</li>
          <li>Chains are local Anvil and solana-test-validator. The logged-in console still asks for a human approve. /break-it broadcasts only after policy allows.</li>
          <li>If Express is compromised it can still ask the demo vault to sign. The scorecard does not cover that.</li>
        </ul>
      </section>
    </main>
  );
}
