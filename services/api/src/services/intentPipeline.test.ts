import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { fileURLToPath } from "node:url";
import { AuditEvent, Intent, Plan, PlanStep, Policy } from "../models/index.js";
import { MockPlanner } from "../planner/mock.js";
import { OpenAIPlanner, type ChatCompletionResult, type ChatCompletionsFn } from "../planner/openai.js";
import { createIntentFlow, installPlanner } from "./intentPipeline.js";

const recordedDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../planner/recorded");

function replay(name: string): ChatCompletionsFn {
  const body = JSON.parse(readFileSync(path.join(recordedDir, name), "utf8")) as ChatCompletionResult;
  return async () => body;
}

const INFINITE =
  "115792089237316195423570985008687907853269984665640564039457584007913129639935";
const ALICE = "0x1111111111111111111111111111111111111111";
const BOB_SOL = "496mWS1YCGE7YVzGzqifoRvzmtgUvgG1Mz3vht22GsSK";

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
  }
  return {
    ok: codes.length === 0,
    policyCodes: codes,
    schemaErrors: [] as string[],
    humanMessages: codes.map((c) => c),
  };
}

function intentDoc(input: Record<string, unknown> = {}) {
  return {
    id: "intent1",
    _id: "intent1",
    userId: "user1",
    text: "Send 5 MOCK_USDC to Alice",
    status: "planning",
    chainHint: null as string | null,
    plannerLatencyMs: null as number | null,
    plannerModel: null as string | null,
    usage: null as { promptTokens: number; completionTokens: number } | null,
    async save() {
      return this;
    },
    ...input,
  };
}

describe("intent pipeline planner cost", { concurrency: false }, () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  let createdPlans: Array<Record<string, unknown>>;
  let logs: string[];

  beforeEach(() => {
    createdPlans = [];
    logs = [];
    installPlanner(new MockPlanner());
    console.log = (msg?: unknown) => {
      logs.push(String(msg));
    };
    mock.method(Intent, "create", async (input: Record<string, unknown>) => intentDoc(input));
    mock.method(AuditEvent, "create", async (doc: unknown) => doc);
    mock.method(Policy, "findOne", () => query(null));
    mock.method(Plan, "create", async (input: Record<string, unknown>) => {
      const plan = { ...input, id: "plan1", _id: "plan1" };
      createdPlans.push(plan);
      return plan;
    });
    mock.method(PlanStep, "insertMany", async () => []);
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/v1/validate")) {
        const body = init?.body ? (JSON.parse(String(init.body)) as { plan?: { steps?: Array<Record<string, unknown>> } }) : {};
        const result = inspectPolicy(body.plan ?? { steps: [] });
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
    installPlanner(new MockPlanner());
  });

  it("stores latency and omits tokens for the mock planner", async () => {
    const result = await createIntentFlow("user1", "Send 5 MOCK_USDC to Alice");
    assert.ok(result.plan);
    const plan = createdPlans[0];
    assert.equal(typeof plan?.plannerLatencyMs, "number");
    assert.ok((plan?.plannerLatencyMs as number) >= 0);
    assert.equal(plan?.plannerModel, null);
    assert.equal(plan?.usage, null);
  });

  it("stores recorded token usage on the plan for the live planner", async () => {
    installPlanner(
      new OpenAIPlanner({
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        chat: replay("valid-transfer.json"),
      }),
    );
    const result = await createIntentFlow("user1", "Send 5 MOCK_USDC to Alice");
    assert.ok(result.plan);
    const plan = createdPlans[0];
    assert.equal(typeof plan?.plannerLatencyMs, "number");
    assert.equal(plan?.plannerModel, "gpt-4o-mini");
    assert.deepEqual(plan?.usage, { promptTokens: 247, completionTokens: 61 });
  });

  it("stores latency and tokens on the intent when live planner schema-misses", async () => {
    installPlanner(
      new OpenAIPlanner({
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        chat: replay("schema-miss.json"),
      }),
    );
    const result = await createIntentFlow("user1", "transfer with extra keys");
    assert.equal(result.plan, null);
    assert.equal(createdPlans.length, 0);
    assert.equal(result.intent.status, "planner_unavailable");
    assert.equal(typeof result.intent.plannerLatencyMs, "number");
    assert.ok((result.intent.plannerLatencyMs as number) >= 0);
    assert.equal(result.intent.plannerModel, "gpt-4o-mini");
    assert.deepEqual(result.intent.usage, { promptTokens: 251, completionTokens: 73 });
  });

  it("stores latency on a rejected_policy plan", async () => {
    const result = await createIntentFlow("user1", "Approve unlimited MOCK_USDC for 0xEvil");
    assert.ok(result.plan);
    const plan = createdPlans[0];
    assert.equal(plan?.status, "rejected_policy");
    assert.equal(typeof plan?.plannerLatencyMs, "number");
    assert.equal(plan?.usage, null);
    const lifecycle = logs
      .map((line) => {
        try {
          return JSON.parse(line) as { event?: string; policyCodes?: string[]; intentId?: string; planId?: string };
        } catch {
          return null;
        }
      })
      .find((row) => row?.event === "plan.rejected_policy");
    assert.ok(lifecycle);
    assert.equal(lifecycle.intentId, "intent1");
    assert.equal(lifecycle.planId, "plan1");
    assert.deepEqual(lifecycle.policyCodes, ["infinite_approve"]);
  });
});
