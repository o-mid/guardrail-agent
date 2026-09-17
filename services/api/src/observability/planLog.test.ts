import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { AuditEvent } from "../models/index.js";
import { recordPlanEvent, writePlanLog } from "./planLog.js";

describe("plan lifecycle JSON log", { concurrency: false }, () => {
  const originalLog = console.log;
  let lines: string[];

  beforeEach(() => {
    lines = [];
    console.log = (msg?: unknown) => {
      lines.push(String(msg));
    };
  });

  afterEach(() => {
    console.log = originalLog;
    mock.restoreAll();
  });

  it("writes one JSON line with intent id, plan id, policy codes, latency, tokens", () => {
    const line = writePlanLog({
      event: "plan.rejected_policy",
      intentId: "intent1",
      planId: "plan1",
      policyCodes: ["infinite_approve"],
      latencyMs: 18,
      tokens: { promptTokens: 247, completionTokens: 61 },
    });
    const parsed = JSON.parse(lines[0] ?? "{}") as typeof line;
    assert.equal(parsed.event, "plan.rejected_policy");
    assert.equal(parsed.intentId, "intent1");
    assert.equal(parsed.planId, "plan1");
    assert.deepEqual(parsed.policyCodes, ["infinite_approve"]);
    assert.equal(parsed.latencyMs, 18);
    assert.deepEqual(parsed.tokens, { promptTokens: 247, completionTokens: 61 });
    assert.equal(typeof parsed.ts, "string");
  });

  it("stores an AuditEvent then logs the same event type", async () => {
    const stored: Array<{ type: string }> = [];
    mock.method(AuditEvent, "create", async (doc: { type: string }) => {
      stored.push(doc);
      return doc;
    });
    await recordPlanEvent({
      type: "plan.awaiting_approval",
      entityId: "plan1",
      userId: "user1",
      payload: { chain: "anvil", steps: 1 },
      intentId: "intent1",
      planId: "plan1",
      latencyMs: 4,
      tokens: null,
    });
    assert.equal(stored[0]?.type, "plan.awaiting_approval");
    const parsed = JSON.parse(lines[0] ?? "{}") as { event?: string; intentId?: string; planId?: string };
    assert.equal(parsed.event, "plan.awaiting_approval");
    assert.equal(parsed.intentId, "intent1");
    assert.equal(parsed.planId, "plan1");
  });
});
