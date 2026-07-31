import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MockPlanner } from "../../services/api/src/planner/mock.ts";
import { defaultRules } from "../../services/api/src/policy/client.ts";

type Fixture = {
  id: string;
  intent?: string;
  plan?: unknown;
  expect: {
    ok: boolean;
    chain?: string;
    action?: string;
    schema?: boolean;
    policyCodes?: string[];
  };
};

const policyUrl = process.env.POLICY_SERVICE_URL ?? "http://127.0.0.1:8090";
const root = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(root, "fixtures");

async function validate(plan: unknown) {
  const r = await fetch(`${policyUrl}/v1/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, policy: { version: 1, rules: defaultRules } }),
  });
  if (!r.ok) throw new Error(`policy ${r.status}`);
  return (await r.json()) as {
    ok: boolean;
    schemaErrors: string[];
    policyCodes: string[];
  };
}

async function main() {
  const files = (await readdir(fixturesDir)).filter((f) => f.endsWith(".json")).sort();
  const planner = new MockPlanner();
  let failed = 0;

  for (const file of files) {
    const fx = JSON.parse(await readFile(path.join(fixturesDir, file), "utf8")) as Fixture;
    let plan = fx.plan;
    if (!plan && fx.intent) {
      plan = await planner.plan({ intent: fx.intent, policySummary: defaultRules });
    }
    if (!plan) {
      console.error("FAIL", fx.id, "no plan");
      failed++;
      continue;
    }

    const result = await validate(plan);
    const problems: string[] = [];

    if (result.ok !== fx.expect.ok) problems.push(`ok=${result.ok} want=${fx.expect.ok}`);
    if (fx.expect.schema && result.schemaErrors.length === 0) problems.push("expected schema errors");
    if (fx.expect.policyCodes) {
      for (const code of fx.expect.policyCodes) {
        if (!result.policyCodes.includes(code)) problems.push(`missing code ${code}`);
      }
    }
    if (fx.expect.ok && fx.expect.chain && (plan as { chain?: string }).chain !== fx.expect.chain) {
      problems.push(`chain=${(plan as { chain?: string }).chain}`);
    }
    if (fx.expect.ok && fx.expect.action) {
      const action = (plan as { steps?: Array<{ action?: string }> }).steps?.[0]?.action;
      if (action !== fx.expect.action) problems.push(`action=${action}`);
    }

    if (problems.length) {
      failed++;
      console.error("FAIL", fx.id, problems.join("; "), result);
    } else {
      console.log("PASS", fx.id);
    }
  }

  console.log(`done ${files.length - failed}/${files.length}`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
