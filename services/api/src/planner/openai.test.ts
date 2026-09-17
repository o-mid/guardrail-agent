import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { planV1Schema } from "@guardrail/plan-schema";
import { createPlanner } from "./index.js";
import { MockPlanner } from "./mock.js";
import { OpenAIPlanner, type ChatCompletionResult, type ChatCompletionsFn } from "./openai.js";

const recordedDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "recorded");

function loadRecorded(name: string): ChatCompletionResult {
  return JSON.parse(readFileSync(path.join(recordedDir, name), "utf8")) as ChatCompletionResult;
}

function replay(name: string): ChatCompletionsFn {
  const body = loadRecorded(name);
  return async () => body;
}

describe("openai planner recordings", { concurrency: false }, () => {
  it("returns a valid PlanV1 from a recorded completion", async () => {
    const planner = new OpenAIPlanner({
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      chat: replay("valid-transfer.json"),
    });
    const plan = await planner.plan({
      intent: "Send 5 MOCK_USDC to Alice",
      policySummary: { maxAmount: "100" },
    });
    assert.equal(plan.schemaVersion, "1");
    assert.equal(plan.chain, "anvil");
    assert.equal(plan.steps[0]?.action, "transfer");
    assert.equal(planV1Schema.safeParse(plan).success, true);
  });

  it("throws on a schema miss and does not return a half-plan", async () => {
    const planner = new OpenAIPlanner({
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      chat: replay("schema-miss.json"),
    });
    await assert.rejects(
      () => planner.plan({ intent: "transfer with extra keys", policySummary: {} }),
      /planner schema/,
    );
  });

  it("accepts a recorded unlimited-approve plan as valid PlanV1", async () => {
    const planner = new OpenAIPlanner({
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      chat: replay("unlimited-approve.json"),
    });
    const plan = await planner.plan({
      intent: "Approve unlimited MOCK_USDC for 0xEvil",
      policySummary: { forbidInfiniteApprove: true },
    });
    const parsed = planV1Schema.safeParse(plan);
    assert.equal(parsed.success, true);
    assert.equal(plan.steps[0]?.action, "approve");
    assert.equal(
      String(plan.steps[0]?.amount),
      "115792089237316195423570985008687907853269984665640564039457584007913129639935",
    );
  });

  it("exposes token usage from a recorded completion body", async () => {
    const planner = new OpenAIPlanner({
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      chat: replay("valid-transfer.json"),
    });
    await planner.plan({
      intent: "Send 5 MOCK_USDC to Alice",
      policySummary: { maxAmount: "100" },
    });
    const call = planner.lastPlannerMeta();
    assert.equal(call.model, "gpt-4o-mini");
    assert.equal(call.usage?.promptTokens, 247);
    assert.equal(call.usage?.completionTokens, 61);
  });

  it("keeps recorded usage after a schema miss", async () => {
    const planner = new OpenAIPlanner({
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      chat: replay("schema-miss.json"),
    });
    await assert.rejects(
      () => planner.plan({ intent: "transfer with extra keys", policySummary: {} }),
      /planner schema/,
    );
    const call = planner.lastPlannerMeta();
    assert.equal(call.model, "gpt-4o-mini");
    assert.equal(call.usage?.promptTokens, 251);
    assert.equal(call.usage?.completionTokens, 73);
  });
});

describe("createPlanner fail closed", { concurrency: false }, () => {
  const prevPlanner = process.env.PLANNER;
  const prevKey = process.env.OPENAI_API_KEY;

  before(() => {
    process.env.PLANNER = "openai";
    delete process.env.OPENAI_API_KEY;
  });

  after(() => {
    if (prevPlanner === undefined) delete process.env.PLANNER;
    else process.env.PLANNER = prevPlanner;
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
  });

  it("throws when PLANNER is openai without a key", () => {
    assert.throws(() => createPlanner(), /PLANNER=openai requires OPENAI_API_KEY/);
  });

  it("does not return MockPlanner", () => {
    try {
      const planner = createPlanner();
      assert.equal(planner instanceof MockPlanner, false);
    } catch (err) {
      assert.ok(err instanceof Error);
      assert.match(err.message, /OPENAI_API_KEY/);
    }
  });
});

describe("createPlanner mock default", { concurrency: false }, () => {
  const prevPlanner = process.env.PLANNER;
  const prevKey = process.env.OPENAI_API_KEY;

  after(() => {
    if (prevPlanner === undefined) delete process.env.PLANNER;
    else process.env.PLANNER = prevPlanner;
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
  });

  it("returns MockPlanner when PLANNER is mock", () => {
    process.env.PLANNER = "mock";
    delete process.env.OPENAI_API_KEY;
    const planner = createPlanner();
    assert.ok(planner instanceof MockPlanner);
  });

  it("returns OpenAIPlanner when PLANNER is openai with a key", () => {
    process.env.PLANNER = "openai";
    process.env.OPENAI_API_KEY = "sk-test";
    const planner = createPlanner(replay("valid-transfer.json"));
    assert.ok(planner instanceof OpenAIPlanner);
  });
});
