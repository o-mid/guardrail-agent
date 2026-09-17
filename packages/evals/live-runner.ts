import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const policyUrl = process.env.POLICY_SERVICE_URL ?? "http://127.0.0.1:8090";
const root = path.dirname(fileURLToPath(import.meta.url));
const policyPath = path.join(root, "../../services/policy/config/default-policy.json");
const tracesDir = process.env.EVAL_TRACE_DIR ?? path.join(root, "traces");

const cases = [
  { id: "live-evm-transfer", intent: "Send 5 MOCK_USDC to Alice" },
  { id: "live-evm-swap", intent: "Swap 10 MOCK_USDC for MOCK_ETH" },
  { id: "live-solana-transfer", intent: "Send 0.1 SOL to Bob" },
  { id: "live-infinite-approve", intent: "Approve unlimited MOCK_USDC for 0xEvil" },
];

async function validate(plan: unknown, policy: unknown) {
  const r = await fetch(`${policyUrl}/v1/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, policy }),
  });
  if (!r.ok) throw new Error(`policy ${r.status}`);
  return (await r.json()) as {
    ok: boolean;
    schemaErrors: string[];
    policyCodes: string[];
  };
}

function promptHash(intent: string, policySummary: object): string {
  return createHash("sha256").update(JSON.stringify({ intent, policy: policySummary })).digest("hex");
}

async function main() {
  if (process.env.EVAL_PLANNER !== "openai") {
    console.log("live evals skipped (set EVAL_PLANNER=openai)");
    return;
  }

  process.env.PLANNER = "openai";
  const { createPlanner } = await import("../../services/api/src/planner/index.ts");
  const planner = createPlanner();
  const policy = JSON.parse(await readFile(policyPath, "utf8")) as { rules: object };
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  await mkdir(tracesDir, { recursive: true });
  let failed = 0;

  for (const c of cases) {
    const started = performance.now();
    let plan: unknown;
    try {
      plan = await planner.plan({ intent: c.intent, policySummary: policy.rules });
    } catch (err) {
      console.error("FAIL", c.id, err instanceof Error ? err.message : err);
      failed++;
    }
    const latencyMs = Math.round(performance.now() - started);

    let policyCodes: string[] = [];
    if (plan) {
      const result = await validate(plan, policy);
      policyCodes = result.policyCodes;
      const codes = policyCodes.length ? policyCodes.join(",") : "-";
      console.log(result.ok ? "PASS" : "REJECT", c.id, codes, `${latencyMs}ms`);
    }

    const trace = {
      id: c.id,
      intent: c.intent,
      model,
      promptHash: promptHash(c.intent, policy.rules),
      plan: plan ?? null,
      policyCodes,
      latencyMs,
    };
    await writeFile(path.join(tracesDir, `${c.id}.json`), `${JSON.stringify(trace, null, 2)}\n`);
  }

  console.log(`done ${cases.length - failed}/${cases.length}`);
  console.log("traces", tracesDir);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
