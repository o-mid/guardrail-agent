import { Intent, Plan, PlanStep, Policy } from "../models/index.js";
import { recordPlanEvent } from "../observability/planLog.js";
import { createPlanner } from "../planner/index.js";
import type { Planner, PlannerUsage } from "../planner/types.js";
import { defaultRules, validatePlan, type PolicyRules } from "../policy/client.js";

let planner: Planner = createPlanner();

export function setPlanner(next: Planner): void {
  planner = next;
}

type PlannerCost = {
  plannerLatencyMs: number;
  plannerModel: string | null;
  usage: PlannerUsage | null;
};

function plannerCost(latencyMs: number): PlannerCost {
  const meta = planner.lastCall?.() ?? {};
  return {
    plannerLatencyMs: latencyMs,
    plannerModel: meta.model ?? null,
    usage: meta.usage ?? null,
  };
}

export async function createIntentFlow(userId: string, text: string, chainHint?: string | null) {
  const intent = await Intent.create({
    userId,
    text,
    status: "planning",
    chainHint: chainHint ?? null,
  });
  await recordPlanEvent({
    type: "intent.received",
    entityId: intent.id,
    userId,
    payload: { text },
    intentId: intent.id,
  });

  const policy = await loadPolicy(userId);
  const started = performance.now();
  let planJson;
  try {
    planJson = await planner.plan({
      intent: text,
      policySummary: policy.rules,
      chainHint,
    });
  } catch (err) {
    const cost = plannerCost(Math.round(performance.now() - started));
    intent.status = "planner_unavailable";
    intent.plannerLatencyMs = cost.plannerLatencyMs;
    intent.plannerModel = cost.plannerModel;
    intent.usage = cost.usage;
    await intent.save();
    await recordPlanEvent({
      type: "intent.planner_unavailable",
      entityId: intent.id,
      userId,
      payload: { error: String(err) },
      intentId: intent.id,
      latencyMs: cost.plannerLatencyMs,
      tokens: cost.usage,
    });
    return { intent, plan: null };
  }
  const cost = plannerCost(Math.round(performance.now() - started));

  let validation;
  try {
    validation = await validatePlan(planJson, { version: policy.version, rules: policy.rules });
  } catch (err) {
    intent.status = "planner_unavailable";
    intent.plannerLatencyMs = cost.plannerLatencyMs;
    intent.plannerModel = cost.plannerModel;
    intent.usage = cost.usage;
    await intent.save();
    await recordPlanEvent({
      type: "intent.policy_unreachable",
      entityId: intent.id,
      userId,
      payload: { error: String(err) },
      intentId: intent.id,
      latencyMs: cost.plannerLatencyMs,
      tokens: cost.usage,
    });
    return { intent, plan: null };
  }

  const policyCodes = validation.policyCodes ?? [];
  const schemaErrors = validation.schemaErrors ?? [];
  const humanMessages = validation.humanMessages ?? [];

  if (!validation.ok) {
    const schemaFail = schemaErrors.length > 0;
    intent.status = schemaFail ? "rejected_schema" : "rejected_policy";
    await intent.save();
    const plan = await Plan.create({
      intentId: intent.id,
      userId,
      schemaVersion: planJson.schemaVersion,
      chain: planJson.chain,
      summary: planJson.summary,
      status: schemaFail ? "rejected_schema" : "rejected_policy",
      rawModelJson: planJson,
      rejectionReasons: [...policyCodes, ...schemaErrors],
      policyVersion: policy.version,
      plannerLatencyMs: cost.plannerLatencyMs,
      plannerModel: cost.plannerModel,
      usage: cost.usage,
    });
    await recordPlanEvent({
      type: schemaFail ? "plan.rejected_schema" : "plan.rejected_policy",
      entityId: plan.id,
      userId,
      payload: {
        policyCodes,
        schemaErrors,
        humanMessages,
      },
      intentId: intent.id,
      planId: plan.id,
      policyCodes,
      latencyMs: cost.plannerLatencyMs,
      tokens: cost.usage,
    });
    return {
      intent,
      plan,
      validation: { ...validation, policyCodes, schemaErrors, humanMessages },
    };
  }

  const plan = await Plan.create({
    intentId: intent.id,
    userId,
    schemaVersion: planJson.schemaVersion,
    chain: planJson.chain,
    summary: planJson.summary,
    status: "awaiting_approval",
    rawModelJson: planJson,
    rejectionReasons: [],
    policyVersion: policy.version,
    plannerLatencyMs: cost.plannerLatencyMs,
    plannerModel: cost.plannerModel,
    usage: cost.usage,
  });

  await PlanStep.insertMany(
    planJson.steps.map((step, index) => ({
      planId: plan.id,
      index,
      action: String(step.action),
      payload: step,
      decodedSummary: decodeStep(step),
      status: "pending",
    })),
  );

  intent.status = "planned";
  await intent.save();
  await recordPlanEvent({
    type: "plan.awaiting_approval",
    entityId: plan.id,
    userId,
    payload: { chain: plan.chain, steps: planJson.steps.length },
    intentId: intent.id,
    planId: plan.id,
    latencyMs: cost.plannerLatencyMs,
    tokens: cost.usage,
  });

  return { intent, plan, validation };
}

export async function loadPolicy(userId: string): Promise<{ version: number; rules: PolicyRules }> {
  const userPolicy = await Policy.findOne({ scope: userId }).sort({ version: -1 });
  if (userPolicy) {
    return { version: userPolicy.version, rules: userPolicy.rules as PolicyRules };
  }
  const globalPolicy = await Policy.findOne({ scope: "global" }).sort({ version: -1 });
  if (globalPolicy) {
    return { version: globalPolicy.version, rules: globalPolicy.rules as PolicyRules };
  }
  return { version: 1, rules: defaultRules };
}

function decodeStep(step: Record<string, unknown>): string {
  const action = String(step.action);
  if (action === "approve") return `approve ${step.amount} ${step.token} for ${step.spender}`;
  if (action === "swap") return `swap ${step.amountIn} ${step.tokenIn} -> ${step.tokenOut}`;
  if (step.mint) return `transfer ${step.amount} ${step.mint} to ${step.to}`;
  return `transfer ${step.amount} ${step.token} to ${step.to}`;
}
