import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { executeEvmStep } from "../executors/evm.js";
import { executeSolanaStep } from "../executors/solana.js";
import { AuditEvent, Plan, PlanStep, Policy } from "../models/index.js";
import { approveStep, setStepRunner, storedPlanJson, type StoredPlanForPolicy } from "./execution.js";

const ALICE = "0x1111111111111111111111111111111111111111";
const EVIL = "0xEeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const INFINITE =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";
const BOB_SOL = "496mWS1YCGE7YVzGzqifoRvzmtgUvgG1Mz3vht22GsSK";
const EVIL_SOL = "11111111111111111111111111111111";

function transferPayload(to = ALICE, amount = "5") {
  return { action: "transfer", token: "MOCK_USDC", to, amount };
}

function approvePayload(amount = "50") {
  return { action: "approve", token: "MOCK_USDC", spender: "MockSwapRouter", amount };
}

function query<T>(result: T) {
  const p = Promise.resolve(result);
  return {
    sort: async () => result,
    then: p.then.bind(p) as Promise<T>["then"],
  };
}

function inspectPolicy(plan: { steps?: Array<Record<string, unknown>> }) {
  const codes: string[] = [];
  for (const step of plan.steps ?? []) {
    const to = step.to != null ? String(step.to) : "";
    if (to && to.toLowerCase() !== ALICE.toLowerCase() && to !== BOB_SOL) {
      codes.push("recipient_not_allowed");
    }
    const amt = String(step.amount ?? step.amountIn ?? "");
    if (amt === INFINITE || amt === "unlimited" || amt === "max" || amt === "infinite") {
      codes.push("infinite_approve");
    }
    const n = Number(amt);
    if (Number.isFinite(n) && n > 100) codes.push("amount_over_cap");
  }
  return {
    ok: codes.length === 0,
    policyCodes: codes,
    schemaErrors: [] as string[],
    humanMessages: codes.map((c) => c),
  };
}

function planDoc(rawSteps: Array<Record<string, unknown>> = [transferPayload(ALICE)]) {
  return {
    id: "plan1",
    _id: "plan1",
    userId: "user1",
    status: "awaiting_approval",
    schemaVersion: "1",
    chain: "anvil",
    summary: "transfer 5 MOCK_USDC",
    policyVersion: 1,
    rawModelJson: {
      schemaVersion: "1",
      chain: "anvil",
      summary: "transfer 5 MOCK_USDC",
      steps: rawSteps,
    },
    async save() {
      return this;
    },
  };
}

function stepDoc(payload: Record<string, unknown>, index = 0) {
  return {
    id: `step${index}`,
    planId: "plan1",
    index,
    action: String(payload.action),
    payload,
    status: "pending",
    error: null,
    txHash: null,
    dryRunOk: null,
    async save() {
      return this;
    },
  };
}

function storedFor(
  payload: Record<string, unknown>,
  extra?: Partial<StoredPlanForPolicy>,
): StoredPlanForPolicy {
  return {
    userId: "user1",
    schemaVersion: "1",
    chain: extra?.chain ?? "anvil",
    summary: extra?.summary ?? "step",
    steps: extra?.steps ?? [{ index: 0, payload }],
  };
}

describe("approve and sign policy re-check", { concurrency: false }, () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  let fetchCalls: Array<{ url: string; body?: { plan?: { steps?: unknown[] } } }>;
  let audits: Array<{ type: string; payload?: Record<string, unknown> }>;
  let claimed: number;
  let ran: number;

  beforeEach(() => {
    fetchCalls = [];
    audits = [];
    claimed = 0;
    ran = 0;
    console.log = () => {};
    mock.method(Policy, "findOne", () => query(null));
    mock.method(AuditEvent, "create", async (doc: { type: string; payload?: Record<string, unknown> }) => {
      audits.push(doc);
      return doc;
    });
    mock.method(PlanStep, "findOneAndUpdate", async () => {
      claimed += 1;
      const step = stepDoc(transferPayload(ALICE));
      step.status = "approved";
      return step;
    });
    mock.method(PlanStep, "countDocuments", async () => 0);
    setStepRunner(async () => {
      ran += 1;
      return { ok: true, dryRunOk: true, txHash: "0xstub" };
    });
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? (JSON.parse(String(init.body)) as { plan?: { steps?: unknown[] } }) : undefined;
      fetchCalls.push({ url, body });
      if (url.includes("/v1/validate")) {
        const result = inspectPolicy((body?.plan ?? { steps: [] }) as { steps?: Array<Record<string, unknown>> });
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    mock.restoreAll();
    setStepRunner(async () => ({ ok: true, dryRunOk: true, txHash: "0xnone" }));
  });

  it("builds policy JSON from step payload, not rawModelJson", () => {
    const plan = planDoc([transferPayload(ALICE)]);
    const steps = [{ index: 0, payload: transferPayload(EVIL, "9") }];
    const json = storedPlanJson(plan, steps);
    assert.equal((json.steps[0] as { to: string }).to, EVIL);
    assert.equal((json.steps[0] as { amount: string }).amount, "9");
    const rawTo = (plan.rawModelJson as { steps: Array<Record<string, unknown>> }).steps[0]?.to;
    assert.equal(rawTo, ALICE);
  });

  it("approves a clean transfer after policy ok", async () => {
    const plan = planDoc();
    const step = stepDoc(transferPayload(ALICE));
    mock.method(Plan, "findOne", async () => plan);
    mock.method(PlanStep, "find", () => query([step]));

    const result = await approveStep("user1", "plan1", 0);
    assert.equal("error" in result, false);
    assert.equal(claimed, 1);
    assert.equal(ran, 1);
    assert.equal(plan.status, "completed");
  });

  it("refuses approve when recipient is mutated on PlanStep.payload", async () => {
    const plan = planDoc([transferPayload(ALICE)]);
    const step = stepDoc(transferPayload(EVIL, "5"));
    mock.method(Plan, "findOne", async () => plan);
    mock.method(PlanStep, "find", () => query([step]));

    const result = await approveStep("user1", "plan1", 0);
    assert.equal("error" in result && result.error === "rejected_policy", true);
    if ("error" in result && result.error === "rejected_policy") {
      assert.ok(result.policyCodes.includes("recipient_not_allowed"));
    }
    assert.equal(claimed, 0);
    assert.equal(ran, 0);
    assert.equal(plan.status, "awaiting_approval");
    assert.equal(step.status, "pending");
    assert.ok(audits.some((a) => a.type === "step.rejected_policy"));
    const posted = fetchCalls.find((c) => c.url.includes("/v1/validate"));
    const postedTo = (posted?.body?.plan?.steps?.[0] as { to?: string } | undefined)?.to;
    assert.equal(postedTo, EVIL);
    assert.ok(!fetchCalls.some((c) => c.url.includes("/v1/evm") || c.url.includes("8100")));
  });

  it("refuses approve when amount is mutated to infinite approve", async () => {
    const plan = planDoc([approvePayload("50")]);
    plan.summary = "approve MOCK_USDC";
    const step = stepDoc(approvePayload(INFINITE));
    mock.method(Plan, "findOne", async () => plan);
    mock.method(PlanStep, "find", () => query([step]));

    const result = await approveStep("user1", "plan1", 0);
    assert.equal("error" in result && result.error === "rejected_policy", true);
    if ("error" in result && result.error === "rejected_policy") {
      assert.ok(result.policyCodes.includes("infinite_approve"));
    }
    assert.equal(claimed, 0);
    assert.equal(ran, 0);
  });

  it("does not sign evm when stored payload recipient is not allowlisted", async () => {
    const payload = transferPayload(EVIL);
    const result = await executeEvmStep(payload, storedFor(payload));
    assert.equal(result.ok, false);
    assert.match(String(result.error), /policy_rejected:recipient_not_allowed/);
    assert.ok(!fetchCalls.some((c) => c.url.includes("/v1/evm") || c.url.includes("/v1/identity")));
  });

  it("does not sign solana when stored payload recipient is not allowlisted", async () => {
    const payload = { action: "transfer", mint: "SOL", to: EVIL_SOL, amount: "0.1" };
    const result = await executeSolanaStep(
      payload,
      storedFor(payload, { chain: "solana-local", summary: "sol transfer" }),
    );
    assert.equal(result.ok, false);
    assert.match(String(result.error), /policy_rejected:recipient_not_allowed/);
    assert.ok(!fetchCalls.some((c) => c.url.includes("/v1/solana") || c.url.includes("/v1/identity")));
  });
});
