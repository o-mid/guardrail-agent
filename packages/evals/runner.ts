import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatFail,
  frozenFailures,
  mismatches,
  type FixtureExpect,
  type PolicyActual,
} from "./compare.ts";

type Fixture = {
  id: string;
  intent?: string;
  plan?: unknown;
  expect: FixtureExpect;
};

const policyUrl = process.env.POLICY_SERVICE_URL ?? "http://127.0.0.1:8090";
const root = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(root, "fixtures");
const policyPath = path.join(root, "../../services/policy/config/default-policy.json");

async function validate(plan: unknown, policy: unknown): Promise<PolicyActual> {
  const r = await fetch(`${policyUrl}/v1/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, policy }),
  });
  if (!r.ok) throw new Error(`policy ${r.status}`);
  return (await r.json()) as PolicyActual;
}

async function main() {
  const files = (await readdir(fixturesDir)).filter((f) => f.endsWith(".json")).sort();
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  const loadedIds = new Set<string>();
  const actualById = new Map<string, PolicyActual | undefined>();
  let fixtureFailed = 0;

  for (const file of files) {
    const fx = JSON.parse(await readFile(path.join(fixturesDir, file), "utf8")) as Fixture;
    loadedIds.add(fx.id);
    const plan = fx.plan;
    if (!plan) {
      console.error("FAIL", fx.id);
      console.error("  expected  a plan object");
      console.error("  actual    missing plan");
      fixtureFailed++;
      actualById.set(fx.id, undefined);
      continue;
    }

    const result = await validate(plan, policy);
    actualById.set(fx.id, result);
    const found = mismatches(fx.expect, result, plan as { chain?: string; steps?: Array<{ action?: string }> });

    if (found.length) {
      fixtureFailed++;
      console.error(formatFail(fx.id, fx.expect, result, found));
    } else {
      console.log("PASS", fx.id);
    }
  }

  const frozen = frozenFailures(loadedIds, actualById);
  for (const err of frozen) {
    console.error(err);
  }

  console.log(`done ${files.length - fixtureFailed}/${files.length}`);
  if (fixtureFailed || frozen.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
