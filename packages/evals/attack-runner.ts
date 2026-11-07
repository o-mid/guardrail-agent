import { execSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FROZEN_ATTACKS, attackMismatches, type AttackActual, type AttackExpect } from "./attack-compare.ts";

type Attack = {
  id: string;
  version: number;
  class: string;
  surface: string;
  input: string;
  plan: unknown;
  context?: unknown;
  expect: AttackExpect;
};

const policyUrl = process.env.POLICY_SERVICE_URL ?? "http://127.0.0.1:8090";
const root = path.dirname(fileURLToPath(import.meta.url));
const attacksDir = path.join(root, "attacks", "v1");
const policyPath = path.join(root, "../../services/policy/config/default-policy.json");
const outPath = path.join(root, "scorecard", "firewall.json");

async function validate(plan: unknown, policy: unknown, context: unknown): Promise<AttackActual> {
  const r = await fetch(`${policyUrl}/v1/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, policy, context: context ?? {} }),
  });
  if (!r.ok) throw new Error(`policy ${r.status}`);
  const body = (await r.json()) as Partial<AttackActual>;
  return {
    ok: Boolean(body.ok),
    schemaErrors: body.schemaErrors ?? [],
    policyCodes: body.policyCodes ?? [],
  };
}

async function main() {
  const files = (await readdir(attacksDir)).filter((file) => file.endsWith(".json")).sort();
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  const loaded = new Set<string>();
  const results: Array<{ id: string; class: string; firewallHeld: boolean; policyCodes: string[] }> = [];
  let failed = 0;

  for (const file of files) {
    const attack = JSON.parse(await readFile(path.join(attacksDir, file), "utf8")) as Attack;
    loaded.add(attack.id);
    const actual = await validate(attack.plan, policy, attack.context);
    const found = attackMismatches(attack.expect, actual);
    results.push({ id: attack.id, class: attack.class, firewallHeld: found.length === 0, policyCodes: actual.policyCodes });
    if (found.length) {
      failed++;
      console.error("FAIL", attack.id);
      for (const item of found) {
        console.error(`  ${item.field}: expected ${JSON.stringify(item.expected)}, actual ${JSON.stringify(item.actual)}`);
      }
    } else {
      console.log("PASS", attack.id, actual.policyCodes.join(",") || "-");
    }
  }

  const missing = FROZEN_ATTACKS.filter((id) => !loaded.has(id));
  for (const id of missing) {
    failed++;
    console.error(`FROZEN MISSING ${id}`);
  }

  let commit = "unknown";
  try {
    commit = execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
  } catch {
    commit = "unknown";
  }
  const summary = {
    kind: "firewall-contract",
    planner: null,
    date: new Date().toISOString(),
    commit,
    cases: files.length,
    passed: files.length - failed,
    failed,
    results,
    liveModel: "not executed",
  };
  if (process.env.SCORECARD_WRITE === "1") {
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(summary, null, 2)}\n`);
  }
  console.log(`done ${summary.passed}/${summary.cases}`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
