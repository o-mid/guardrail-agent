import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPlanner } from "./index.js";
import { AnthropicPlanner, type MessagesFn } from "./anthropic.js";
import { MockPlanner } from "./mock.js";

const transfer = {
  schemaVersion: "1",
  chain: "anvil",
  summary: "Send 5 MOCK_USDC",
  steps: [
    {
      action: "transfer",
      token: "MOCK_USDC",
      to: "0x1111111111111111111111111111111111111111",
      amount: "5",
    },
  ],
};

function messages(): MessagesFn {
  return async () => ({
    model: "claude-test",
    content: [{ type: "text", text: JSON.stringify(transfer) }],
    usage: { input_tokens: 20, output_tokens: 12 },
  });
}

describe("anthropic planner", () => {
  it("returns PlanV1 from a messages payload", async () => {
    const planner = new AnthropicPlanner({
      apiKey: "test-key",
      model: "claude-test",
      messages: messages(),
    });
    const plan = await planner.plan({ intent: "Send 5 MOCK_USDC to Alice", policySummary: {} });
    assert.equal(plan.chain, "anvil");
    assert.equal(plan.steps[0]?.action, "transfer");
    assert.equal(planner.lastPlannerMeta().usage?.promptTokens, 20);
    assert.equal(planner.lastPlannerMeta().usage?.completionTokens, 12);
  });
});

describe("createPlanner anthropic fail closed", { concurrency: false }, () => {
  const prevPlanner = process.env.PLANNER;
  const prevKey = process.env.ANTHROPIC_API_KEY;
  const prevModel = process.env.ANTHROPIC_MODEL;

  before(() => {
    process.env.PLANNER = "anthropic";
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
  });

  after(() => {
    if (prevPlanner === undefined) delete process.env.PLANNER;
    else process.env.PLANNER = prevPlanner;
    if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevKey;
    if (prevModel === undefined) delete process.env.ANTHROPIC_MODEL;
    else process.env.ANTHROPIC_MODEL = prevModel;
  });

  it("throws when the key is missing", () => {
    assert.throws(() => createPlanner(), /ANTHROPIC_API_KEY/);
  });

  it("throws when the model is missing", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    assert.throws(() => createPlanner(), /ANTHROPIC_MODEL/);
  });

  it("does not return MockPlanner", () => {
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const planner = createPlanner();
      assert.equal(planner instanceof MockPlanner, false);
    } catch (err) {
      assert.ok(err instanceof Error);
      assert.match(err.message, /ANTHROPIC_API_KEY/);
    }
  });

  it("returns AnthropicPlanner when key and model are set", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
    const planner = createPlanner(undefined, messages());
    assert.ok(planner instanceof AnthropicPlanner);
  });
});
